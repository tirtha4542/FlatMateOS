
```markdown
# 🏠 FlatMate-OS (v3.0.0)

FlatMate-OS is an intelligent, automated expense ledger and chore management application designed to eliminate shared-flat friction. By integrating a high-performance **FastAPI** backend with a zero-shot **Mistral AI** natural language parser and a strict relational **PostgreSQL** tracking database, the system allows flatmates to log expenses and schedule duties typing normal, everyday sentences.

---

## 🚀 Architectural Overview & Data Flow

The application handles full text-to-intent pipelining. Unstructured messages are parsed into transactional parameters, validated against relational foreign keys, split evenly across residents, and logged while concurrently triggering communication notifications via SMTP.

Here is the Level 1 and Level 2 **Technical Data Flow Diagram (DFD)** mapping out the execution pipeline of the application:

![FlatMate-OS Technical Data Flow Diagram](dfd_diagram.png)


```

```
                  LEVEL 1 & LEVEL 2 SYSTEM DATA FLOW DIAGRAM

```

+-------------------------+       User Message      +------------------------+
|   EE1: USER INTERFACE   | ----------------------> | P1.0: FlatMate-OS Core |
| (Dashboard UI / Chat)   | <---------------------- |    (FastAPI Backend)   |
+-------------------------+     Success & JSON      +------------------------+
|
+----------------------+----------------------------+------------------------+
| AI Parsing Traffic   | Financial Balances Update  | Duty / Notification    |
v                      v                            v                        v
+------------------+   +-------------------+       +--------------------+   +-------------------+
|   ES1: MISTRAL   |   |   DS1: USERS DB   |       |  DS2: EXPENSES DB  |   | DS3: TURN_SCHED DB|
| (json_object API)|   | (Relational Owed) |       |  (Audit Ledger)    |   | (Chore Tracking)  |
+------------------+   +-------------------+       +--------------------+   +-------------------+
|
v
+-------------------+
| ES2: EMAIL SERVER |
|  (SMTP SSL 465)   |
+-------------------+

```

---

## 🛠️ Technology Stack & System Specs

* **Backend Infrastructure:** `FastAPI` (Python 3.10+) utilizing asynchronous connection architectures.
* **Artificial Intelligence Parser:** `Mistral AI` (`mistral-small-latest`) forced to compile strict parameters natively via structural JSON output formatting rules.
* **Database Ledger:** `PostgreSQL` enforcing absolute scalar financial integrity across strict transactional operations.
* **Communication Routing:** Standard `SMTP` over SSL (`Port 465`) compiling responsive HTML notification templates dynamically on-the-fly.
* **Frontend Web Application:** Vanilla JavaScript optimized with modular asynchronous fetch routines, styling rules built entirely on a custom neon terminal interface pattern, and dynamic, interactive graphs built via `Chart.js`.

---

## 📊 Relational Database Design

The relational database architecture is built specifically around **exactly 5 registered flatmates**: `Tirtha`, `Murshed`, `Kishor`, `Tarek`, and `Siam`. It dynamically tracks currency movements down to two decimal places utilizing exact monetary fractions (`NUMERIC(12,2)`) instead of floating-point representations to eliminate programmatic compounding roundoff anomalies.

### Complete PostgreSQL Generation Schema (`schema.sql`)
```sql
-- Create the Core Users Structure
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50)   NOT NULL UNIQUE,
    email       VARCHAR(120)  NOT NULL UNIQUE,
    amount_owed NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Create the Persistent Transaction Ledger Table
CREATE TABLE expenses (
    id           SERIAL PRIMARY KEY,
    payer        VARCHAR(50)   NOT NULL REFERENCES users(name) ON UPDATE CASCADE,
    item         TEXT          NOT NULL,
    category     VARCHAR(60)   NOT NULL DEFAULT 'General',
    total_amount NUMERIC(12,2) NOT NULL,
    split_share  NUMERIC(12,2) NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Create the Task Roster Matrix Table
CREATE TABLE turn_schedule (
    id           SERIAL PRIMARY KEY,
    assigned_to  VARCHAR(50)   NOT NULL REFERENCES users(name) ON UPDATE CASCADE,
    duty_type    VARCHAR(120)  NOT NULL,
    scheduled_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    notified     BOOLEAN       NOT NULL DEFAULT FALSE
);

-- Seed Clean Real-World Flatmate Registers With Pristine Balances
INSERT INTO users (name, email, amount_owed) VALUES
('Tirtha', 'tirthabepari96962@gmail.com', 0.00),
('Murshed', 'murshedulkhoyer2017@gmail.com', 0.00),
('Kishor', 'explain001100@gmail.com', 0.00),
('Tarek', 'tremorlabs0@gmail.com', 0.00),
('Siam', 'siam@gmail.com', 0.00);

```

---

## 🔌 API Documentation Matrix

### 1. Execute Intelligent Command Pipeline

* **Endpoint:** `POST /api/process`
* **Content-Type:** `application/json`
* **Request Payload Structure:**
```json
{ "message": "Murshed paid 150 for fish" }

```


* **Execution Logic Sequence:**
1. The raw phrase is parsed by Mistral AI, mapping it to a strict structural JSON schema matching `intent: add_expense`.
2. The overall cost (৳150.00) is split dynamically across all 5 active members (৳30.00 each).
3. The individual balance matrix updates immediately: Payer `Murshed` is credited (`+৳120.00`), while the remaining four users are penalized (`-৳30.00`) inside the database.


* **Successful Processing JSON Payload Response:**
```json
{
  "status": "success",
  "intent": "add_expense",
  "message": "✅ Murshed paid ৳150.00 for fish. Each flatmate owes ৳30.00.",
  "parsed": {
    "intent": "add_expense",
    "payer": "Murshed",
    "amount": 150.0,
    "item": "fish",
    "category": "Food",
    "duty_type": null,
    "assigned_to": null
  }
}

```



### 2. Fetch User Financial Matrix

* **Endpoint:** `GET /api/balances`
* **Successful JSON Payload Response Array:**
```json
[
  { "name": "Tirtha", "amount_owed": 0.0 },
  { "name": "Murshed", "amount_owed": 120.0 },
  { "name": "Kishor", "amount_owed": -30.0 },
  { "name": "Tarek", "amount_owed": -30.0 },
  { "name": "Siam", "amount_owed": -30.0 }
]

```



### 3. Fetch Historical Expense Logs

* **Endpoint:** `GET /api/expenses`
* **Successful JSON Payload Response Array:**
```json
[
  {
    "payer": "Murshed",
    "item": "fish",
    "category": "Food",
    "total_amount": 150.0,
    "split_share": 30.0,
    "created_at": "2026-05-30T16:40:12.112441+06:00"
  }
]

```



### 4. Fetch Active Task Schedule Matrix

* **Endpoint:** `GET /api/turns`

### 5. Fetch Analytical Metrics (Time-Series Metrics / Categorical Slices)

* **Endpoints:** `GET /api/monthly` & `GET /api/category-totals`

---

## ⚙️ Local Implementation & Setup Guide

### 1. Clone Project Directory Repository

```bash
git clone [https://github.com/YOUR_USERNAME/FlatMate-OS.git](https://github.com/YOUR_USERNAME/FlatMate-OS.git)
cd FlatMate-OS

```

### 2. Configure Local Virtual Environment Workspace

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows, implement: .venv\Scripts\activate
pip install -r requirements.txt

```

### 3. Establish Local Environmental Constants Configurations

Create a `.env` file within the root project directory level:

```env
DATABASE_URL=postgresql://postgres:YOUR_SECRET_DB_PASSWORD@localhost:5432/flatmate_db
MISTRAL_API_KEY=your_actual_confidential_mistral_api_token
SENDER_EMAIL=your_dedicated_system_notification_gmail@gmail.com
SENDER_PASSWORD=your_secure_16_digit_google_app_password

```

### 4. Direct Initialization & Initialization of Core Relational Database Tables

* Open your **pgAdmin Query Tool** interface terminal mapped directly inside your active `flatmate_db`.
* Paste the query script block provided above inside the **PostgreSQL Generation Schema** step block section.
* Press **`F5`** to completely construct your workspace tables and register the five core residents.

### 5. Fire Up Asynchronous Application Servers

Initialize your local production instance server mapping explicitly to the specified backend port layout:

```bash
uvicorn main:app --reload --port 8000

```

### 6. Access UI Dashboard Control Panel Live Interface

Open your web browser window and route requests down directly into your preferred endpoint layout configuration:

* To run through the fully automated proxy system configuration, simply access the live pipeline link: `http://localhost:8000`
* If serving raw files separately via separate preview tool containers (like VS Code Live Server on Port `5501`), navigate to: `http://127.0.0.1:5501/static/index.html` (The internal routing matrix blocks integrated directly inside your `app.js` updates will automatically map and bridge communications safely across your server origins via CORS channels).

---

## 🔒 Security Practices Notice

The `.gitignore` configuration rules block has been completely structured within this repository to explicitly isolate your local `.env` variables from any network uploads. Never remove these configuration rules blocks or expose credentials when managing your repository histories publicly online.

---

## 📄 Licensing & Distribution Info

Distributed under standard Open Source guidelines. Feel free to clone, optimize, restructure, and apply inside your local shared apartments!

```

```
