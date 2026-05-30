"""
FlatMate-OS · FastAPI Backend
Run: uvicorn main:app --reload --port 8000
"""

import os, json, smtplib
import psycopg2
from psycopg2.extras import RealDictCursor
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from contextlib import contextmanager
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mistralai.client import Mistral

load_dotenv()

DATABASE_URL    = os.getenv("DATABASE_URL")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
SENDER_EMAIL    = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

VALID_MEMBERS = {"Tirtha", "Murshed", "Kishor", "Tarek", "Siam"}

app = FastAPI(title="FlatMate-OS", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="static"), name="static")

mistral_client = Mistral(api_key=MISTRAL_API_KEY)


# ── DB ────────────────────────────────────────────────────────────
@contextmanager
def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Schemas ───────────────────────────────────────────────────────
class MessageRequest(BaseModel):
    message: str

class ParsedIntent(BaseModel):
    intent: str
    payer: Optional[str] = None
    amount: Optional[float] = None
    item: Optional[str] = None
    category: Optional[str] = "General"
    duty_type: Optional[str] = None
    assigned_to: Optional[str] = None


# ── Mistral AI ────────────────────────────────────────────────────
SYSTEM_PROMPT = """
You are an intelligent expense and duty parser for a flat of exactly 5 members:
Tirtha, Murshed, Kishor, Tarek, Siam.

Analyse the user message and return ONLY a raw minified JSON object.
No markdown, no backticks, no explanation, no extra text at all.

JSON schema:
{
  "intent": "add_expense" or "assign_turn",
  "payer": "one of the 5 names (correct case) or null",
  "amount": <float> or null,
  "item": "concise purchase description or null",
  "category": "one of: Food, Groceries, Utilities, Internet, Rent, Transport, Entertainment, General",
  "duty_type": "e.g. Bazaar Duty, Flat Cleaning, Cooking Turn or null",
  "assigned_to": "one of the 5 names (correct case) or null"
}

Rules:
- Resolve names case-insensitively: "tirtha"→"Tirtha", "murshed"→"Murshed" etc.
- Money/payment/expense → intent = "add_expense". Fill payer, amount, item, category.
- Chore/turn/duty/task/assign → intent = "assign_turn". Fill assigned_to, duty_type.
- Only use names from the 5 valid members. Use null if uncertain.
- Return ONLY the JSON. Nothing else.
"""

def parse_with_mistral(message: str) -> ParsedIntent:
    response = mistral_client.chat.complete(
        model="mistral-small-latest",
        response_format={"type": "json_object"},  # Forces Mistral to answer strictly in JSON
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": message},
        ],
    )
    raw = response.choices[0].message.content.strip()
    
    # No more fragile manual backtick slicing needed!
    data = json.loads(raw)
    return ParsedIntent(**data)


# ── Expense logic ─────────────────────────────────────────────────
def apply_expense(conn, payer: str, total_amount: float, item: str, category: str):
    split_share  = round(total_amount / 5, 2)
    payer_credit = round(total_amount - split_share, 2)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO expenses (payer, item, category, total_amount, split_share) VALUES (%s,%s,%s,%s,%s)",
            (payer, item, category, total_amount, split_share),
        )
        cur.execute(
            "UPDATE users SET amount_owed = amount_owed + %s WHERE name = %s",
            (payer_credit, payer),
        )
        for member in VALID_MEMBERS:
            if member != payer:
                cur.execute(
                    "UPDATE users SET amount_owed = amount_owed - %s WHERE name = %s",
                    (split_share, member),
                )


# ── Email ─────────────────────────────────────────────────────────
def send_duty_email(recipient_email: str, recipient_name: str, duty_type: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🏠 FlatMate-OS — Your Duty: {duty_type}"
    msg["From"]    = SENDER_EMAIL
    msg["To"]      = recipient_email
    html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body{{font-family:'Segoe UI',sans-serif;background:#070a10;margin:0;padding:0}}
  .w{{max-width:520px;margin:40px auto;background:#0c1018;border-radius:14px;
      overflow:hidden;border:1px solid rgba(255,255,255,0.07)}}
  .h{{background:linear-gradient(135deg,#00e5c8,#0077ff);padding:28px;text-align:center}}
  .h h1{{margin:0;color:#000;font-size:1.4rem;font-weight:900;letter-spacing:.06em}}
  .b{{padding:28px}}
  .b p{{color:#8492a6;line-height:1.7;font-size:.92rem;margin:0 0 10px}}
  .nm{{color:#e8edf5;font-weight:700}}
  .badge{{display:inline-block;background:rgba(0,229,200,.1);border:1px solid
          rgba(0,229,200,.3);color:#00e5c8;padding:8px 22px;border-radius:100px;
          font-weight:700;font-size:.95rem;margin:8px 0}}
  .f{{padding:12px 28px;border-top:1px solid rgba(255,255,255,.05);
      color:#3d4a5c;font-size:.7rem;text-align:center;font-family:monospace}}
</style></head>
<body><div class="w">
  <div class="h"><h1>🏠 FlatMate-OS</h1></div>
  <div class="b">
    <p>Hey <span class="nm">{recipient_name}</span>,</p>
    <p>You have been assigned a new flat duty:</p>
    <div class="badge">{duty_type}</div>
    <p>Please complete it on time. Your flatmates are counting on you 💪</p>
  </div>
  <div class="f">Sent automatically by FlatMate-OS · Do not reply</div>
</div></body></html>"""
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, recipient_email, msg.as_string())


def apply_turn(conn, assigned_to: str, duty_type: str):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO turn_schedule (assigned_to, duty_type, notified) VALUES (%s,%s,%s)",
            (assigned_to, duty_type, True),
        )
        cur.execute("SELECT email FROM users WHERE name = %s", (assigned_to,))
        row = cur.fetchone()
    if row and row["email"]:
        try:
            send_duty_email(row["email"], assigned_to, duty_type)
        except Exception as e:
            print(f"[EMAIL WARNING] {e}")


# ── Routes ────────────────────────────────────────────────────────
@app.get("/")
def index():
    return FileResponse("static/index.html")


@app.post("/api/process")
def process_message(req: MessageRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    try:
        parsed = parse_with_mistral(req.message)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {e}")

    if parsed.intent == "add_expense":
        if not parsed.payer or parsed.payer not in VALID_MEMBERS:
            raise HTTPException(status_code=422, detail="Could not identify a valid payer.")
        if not parsed.amount or parsed.amount <= 0:
            raise HTTPException(status_code=422, detail="Could not identify a valid amount.")
        item     = parsed.item or "General expense"
        category = parsed.category or "General"
        try:
            with get_db() as conn:
                apply_expense(conn, parsed.payer, parsed.amount, item, category)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"DB error: {e}")
        split = round(parsed.amount / 5, 2)
        return {
            "status":  "success",
            "intent":  "add_expense",
            "message": f"✅ {parsed.payer} paid ৳{parsed.amount:.2f} for {item}. Each flatmate owes ৳{split:.2f}.",
            "parsed":  parsed.model_dump(),
        }

    elif parsed.intent == "assign_turn":
        if not parsed.assigned_to or parsed.assigned_to not in VALID_MEMBERS:
            raise HTTPException(status_code=422, detail="Could not identify a valid member.")
        duty = parsed.duty_type or "Flat Duty"
        try:
            with get_db() as conn:
                apply_turn(conn, parsed.assigned_to, duty)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"DB/email error: {e}")
        return {
            "status":  "success",
            "intent":  "assign_turn",
            "message": f"📧 '{duty}' assigned to {parsed.assigned_to} — email sent!",
            "parsed":  parsed.model_dump(),
        }

    raise HTTPException(status_code=422, detail="Could not determine intent. Try rephrasing.")


@app.get("/api/balances")
def get_balances():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT name, amount_owed FROM users ORDER BY id")
                rows = cur.fetchall()
        return [{"name": r["name"], "amount_owed": float(r["amount_owed"])} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/expenses")
def get_expenses():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT payer, item, category, total_amount, split_share, created_at "
                    "FROM expenses ORDER BY created_at DESC LIMIT 30"
                )
                rows = cur.fetchall()
        return [
            {
                "payer":        r["payer"],
                "item":         r["item"],
                "category":     r["category"],
                "total_amount": float(r["total_amount"]),
                "split_share":  float(r["split_share"]),
                "created_at":   r["created_at"].isoformat(),
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/turns")
def get_turns():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT assigned_to, duty_type, scheduled_at, notified "
                    "FROM turn_schedule ORDER BY scheduled_at DESC LIMIT 20"
                )
                rows = cur.fetchall()
        return [
            {
                "assigned_to":  r["assigned_to"],
                "duty_type":    r["duty_type"],
                "scheduled_at": r["scheduled_at"].isoformat(),
                "notified":     r["notified"],
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/monthly")
def get_monthly():
    """Returns last 6 months of total spending for the line chart."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT
                        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
                        DATE_TRUNC('month', created_at) AS month_date,
                        SUM(total_amount) AS total
                    FROM expenses
                    WHERE created_at >= NOW() - INTERVAL '6 months'
                    GROUP BY month_date, month
                    ORDER BY month_date ASC
                """)
                rows = cur.fetchall()
        return [{"month": r["month"], "total": float(r["total"])} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/category-totals")
def get_category_totals():
    """Returns spending totals per category for the pie breakdown."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT category, SUM(total_amount) AS total
                    FROM expenses
                    GROUP BY category
                    ORDER BY total DESC
                """)
                rows = cur.fetchall()
        return [{"category": r["category"], "total": float(r["total"])} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
