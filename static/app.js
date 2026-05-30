// ================================================================
//  FlatMate-OS · app.js
// ================================================================

/* ── Animated grid background ──────────────────────────────────── */
(function () {
  const canvas = document.getElementById('grid-canvas');
  const ctx = canvas.getContext('2d');
  let W, H;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,229,200,0.055)';
    ctx.lineWidth = 1;
    const sp = 52;
    for (let x = 0; x < W; x += sp) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += sp) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(
      W / 2,
      H / 2,
      H * 0.05,
      W / 2,
      H / 2,
      H * 0.85,
    );
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, 'rgba(7,10,16,0.94)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  resize();
  draw();
  window.addEventListener('resize', () => {
    resize();
    draw();
  });
})();

/* ── Helpers ───────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const esc = s =>
  String(s).replace(
    /[&<>'"]/g,
    t =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[
        t
      ],
  );
const fmtDate = iso => {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
};
const fmtTaka = n =>
  '৳' +
  parseFloat(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const CATEGORY_COLORS = {
  Food: '#00e5c8',
  Groceries: '#22d3a0',
  Utilities: '#f5c842',
  Internet: '#9d7fff',
  Rent: '#ff4d6a',
  Transport: '#0088ff',
  Entertainment: '#ff9f43',
  General: '#8492a6',
};

function categoryTag(cat) {
  const c = CATEGORY_COLORS[cat] || '#8492a6';
  return `<span class="tag" style="background:${c}22;color:${c};border:1px solid ${c}44">${esc(cat)}</span>`;
}

/* ── Input handling ────────────────────────────────────────────── */
const input = $('message-input');
const sendBtn = $('send-btn');
const btnText = $('btn-text');
const spinner = $('btn-spinner');
const feedEl = $('feedback');

input.addEventListener('input', () => {
  sendBtn.disabled = !input.value.trim();
});
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (input.value.trim()) runCommand();
  }
});
sendBtn.addEventListener('click', runCommand);

function fillInput(text) {
  input.value = text;
  input.focus();
  sendBtn.disabled = false;
}

function setFeedback(msg, type) {
  feedEl.className = 'feedback ' + type;
  feedEl.textContent = msg;
}
function setLoading(on) {
  sendBtn.disabled = on;
  btnText.textContent = on ? 'Running…' : 'Run Command';
  spinner.classList.toggle('hidden', !on);
  input.disabled = on;
}

/* ── Run command ───────────────────────────────────────────────── */
async function runCommand() {
  const msg = input.value.trim();
  if (!msg) return;
  setLoading(true);
  setFeedback('⏳ Sending to Mistral AI…', 'loading');
  try {
    const res = await fetch('http://localhost:8000/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });

    // Fallback security check to ensure it's not raw HTML crashing JSON parses
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const rawText = await res.text();
      throw new Error(
        `Server returned non-JSON format (Status ${res.status}). Ensure backend database is set up and running.`,
      );
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Server error');
    setFeedback(data.message, 'success');
    input.value = '';
    sendBtn.disabled = true;
    await loadAll();
  } catch (err) {
    setFeedback('✗ ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

/* ── Load all data ─────────────────────────────────────────────── */
async function loadAll() {
  await Promise.all([
    loadBalances(),
    loadExpenses(),
    loadTurns(),
    loadCharts(),
  ]);
}

/* ── Balances ──────────────────────────────────────────────────── */
const AVATARS = {
  Tirtha: 'T',
  Murshed: 'M',
  Kishor: 'K',
  Tarek: 'Tk',
  Siam: 'S',
};

async function loadBalances() {
  try {
    const rows = await fetch('http://localhost:8000/api/balances').then(r =>
      r.json(),
    );
    const grid = $('balance-grid');
    grid.innerHTML = rows
      .map(u => {
        const amt = parseFloat(u.amount_owed);
        const cls = amt > 0 ? 'pos' : amt < 0 ? 'neg' : 'zero';
        const sign = amt > 0 ? '+' : '';
        const label = amt > 0 ? 'IS OWED' : amt < 0 ? 'OWES' : 'SETTLED';
        return `<div class="balance-card">
        <div class="bc-avatar">${esc(AVATARS[u.name] || u.name[0])}</div>
        <div class="bc-name">${esc(u.name)}</div>
        <div class="bc-amount ${cls}">${sign}৳${Math.abs(amt).toFixed(2)}</div>
        <div class="bc-label">${label}</div>
      </div>`;
      })
      .join('');
  } catch (e) {
    console.error('Balances:', e);
  }
}

/* ── Expenses ──────────────────────────────────────────────────── */
async function loadExpenses() {
  try {
    const rows = await fetch('http://localhost:8000/api/expenses').then(r =>
      r.json(),
    );

    // Stats
    const now = new Date();
    const thisMonth = rows.filter(r => {
      const d = new Date(r.created_at);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    });
    const monthTotal = thisMonth.reduce((s, r) => s + r.total_amount, 0);
    $('stat-month').textContent = fmtTaka(monthTotal);
    $('stat-count').textContent = rows.length;

    // Table
    const tbody = $('expense-tbody');
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="empty-row">No expenses recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        r => `<tr>
      <td><strong>${esc(r.payer)}</strong></td>
      <td>${esc(r.item)}</td>
      <td>${categoryTag(r.category)}</td>
      <td>${fmtTaka(r.total_amount)}</td>
      <td style="color:var(--red)">৳${parseFloat(r.split_share).toFixed(2)}</td>
      <td>${fmtDate(r.created_at)}</td>
    </tr>`,
      )
      .join('');
  } catch (e) {
    console.error('Expenses:', e);
  }
}

/* ── Turns ─────────────────────────────────────────────────────── */
async function loadTurns() {
  try {
    const rows = await fetch('http://localhost:8000/api/turns').then(r =>
      r.json(),
    );
    $('stat-duties').textContent = rows.length;
    const tbody = $('turn-tbody');
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-row">No duties assigned yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        r => `<tr>
      <td><strong>${esc(r.assigned_to)}</strong></td>
      <td><span class="tag tag-cyan">${esc(r.duty_type)}</span></td>
      <td>${fmtDate(r.scheduled_at)}</td>
      <td>${r.notified ? '<span class="tag tag-green">✓ Sent</span>' : '<span style="color:var(--ink3)">—</span>'}</td>
    </tr>`,
      )
      .join('');
  } catch (e) {
    console.error('Turns:', e);
  }
}

/* ── Charts ────────────────────────────────────────────────────── */
let lineChart = null;
let pieChart = null;

const CHART_DEFAULTS = {
  color: '#8492a6',
  plugins: {
    legend: {
      labels: {
        color: '#8492a6',
        font: { family: 'JetBrains Mono', size: 11 },
      },
    },
  },
};

async function loadCharts() {
  await Promise.all([loadLineChart(), loadPieChart()]);
}

async function loadLineChart() {
  try {
    const data = await fetch('http://localhost:8000/api/monthly').then(r =>
      r.json(),
    );
    const labels = data.map(d => d.month);
    const values = data.map(d => d.total);

    if (lineChart) lineChart.destroy();

    const ctx = $('line-chart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(0,229,200,0.25)');
    gradient.addColorStop(1, 'rgba(0,229,200,0.0)');

    lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Spending (৳)',
            data: values,
            borderColor: '#00e5c8',
            backgroundColor: gradient,
            borderWidth: 2.5,
            pointBackgroundColor: '#00e5c8',
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#8492a6',
              font: { family: 'JetBrains Mono', size: 11 },
            },
          },
          tooltip: {
            backgroundColor: '#0c1018',
            borderColor: 'rgba(0,229,200,0.3)',
            borderWidth: 1,
            titleColor: '#e8edf5',
            bodyColor: '#00e5c8',
            callbacks: { label: ctx => ' ৳' + ctx.parsed.y.toFixed(2) },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#3d4a5c',
              font: { family: 'JetBrains Mono', size: 10 },
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            ticks: {
              color: '#3d4a5c',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: v => '৳' + v,
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
        },
      },
    });
  } catch (e) {
    console.error('Line chart:', e);
  }
}

async function loadPieChart() {
  try {
    const data = await fetch('http://localhost:8000/api/category-totals').then(
      r => r.json(),
    );
    if (!data.length) return;

    if (pieChart) pieChart.destroy();

    const labels = data.map(d => d.category);
    const values = data.map(d => d.total);
    const colors = labels.map(l => CATEGORY_COLORS[l] || '#8492a6');

    pieChart = new Chart($('pie-chart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors.map(c => c + '99'),
            borderColor: colors,
            borderWidth: 1.5,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#8492a6',
              font: { family: 'JetBrains Mono', size: 10 },
              padding: 14,
            },
          },
          tooltip: {
            backgroundColor: '#0c1018',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#e8edf5',
            bodyColor: '#8492a6',
            callbacks: {
              label: ctx =>
                ` ৳${ctx.parsed.toFixed(2)} (${Math.round((ctx.parsed / ctx.dataset.data.reduce((a, b) => a + b, 0)) * 100)}%)`,
            },
          },
        },
      },
    });
  } catch (e) {
    console.error('Pie chart:', e);
  }
}

/* ── Tab switcher ──────────────────────────────────────────────── */
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document
    .querySelectorAll('.tab-panel')
    .forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  $('tab-' + name).classList.add('active');
}

/* ── Boot ──────────────────────────────────────────────────────── */
loadAll();
