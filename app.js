/* ─── STATE ──────────────────────────────── */
let currentUser = null;
let currentUserData = null;
let charts = {};
const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const authHeaders = {
    'Content-Type': 'application/json'
  };

  if (currentUserData?.token) {
    authHeaders.Authorization = `Bearer ${currentUserData.token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers
    }
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || `Request failed with status ${response.status}`);
  }

  return data;
}

/* ─── DATE HELPERS ───────────────────────── */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prevDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0')
  ].join('-');
}

function fmtDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

function shortDate(str) {
  return str.slice(5); // MM-DD
}

/* ─── TOAST ──────────────────────────────── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

/* ─── AUTH MESSAGES ──────────────────────── */
function setMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + type;
}
function clearMsg(id) {
  const el = document.getElementById(id);
  el.textContent = '';
  el.className = 'msg';
}

/* ─── PAGE NAVIGATION ────────────────────── */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showLogin()  { clearMsg('liMsg'); showPage('pageLogin');  }
function showSignup() { clearMsg('suMsg'); showPage('pageSignup'); }

/* ─── SECTION NAVIGATION ─────────────────── */
function switchSection(sectionId, navEl) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  // Show the target section
  document.getElementById(sectionId).classList.add('active');
  // Activate the clicked nav item
  navEl.classList.add('active');

  // Render section-specific content
  const data = getUserData();
  const entries = data ? (data.entries || []) : [];

  if (sectionId === 'secProgress') renderProgressCharts(entries);
  if (sectionId === 'secHistory')  renderHistoryTable(entries);
}

/* ─── AUTH ───────────────────────────────── */
async function signup() {
  const user = document.getElementById('suUser').value.trim();
  const pass = document.getElementById('suPass').value;

  if (!user || !pass)  return setMsg('suMsg', 'Please fill in all fields.', 'error');
  if (pass.length < 4) return setMsg('suMsg', 'Password must be at least 4 characters.', 'error');

  try {
    const result = await apiFetch('/signup', {
      method: 'POST',
      body: JSON.stringify({ username: user, password: pass })
    });

    currentUser = result.username;
    currentUserData = result;
    setMsg('suMsg', 'Account created! Signing you in…', 'success');
    setTimeout(() => openDashboard(), 800);
  } catch (err) {
    setMsg('suMsg', err.message || 'Unable to create account.', 'error');
  }
}

async function login() {
  const user = document.getElementById('liUser').value.trim();
  const pass = document.getElementById('liPass').value;

  if (!user || !pass) return setMsg('liMsg', 'Please fill in all fields.', 'error');

  try {
    const result = await apiFetch('/login', {
      method: 'POST',
      body: JSON.stringify({ username: user, password: pass })
    });

    currentUser = result.username;
    currentUserData = result;
    openDashboard();
  } catch (err) {
    setMsg('liMsg', err.message || 'Unable to sign in.', 'error');
  }
}

function logout() {
  // Destroy all charts
  Object.values(charts).forEach(c => { if (c) c.destroy(); });
  charts = {};
  currentUser = null;
  currentUserData = null;
  showPage('pageLogin');
  clearMsg('liMsg');
}

/* ─── USER DATA ──────────────────────────── */
function getUserData() {
  return currentUserData;
}

function setUserData(data) {
  currentUserData = data;
}

/* ─── OPEN DASHBOARD ─────────────────────── */
function openDashboard() {
  showPage('dashboard');

  // Reset to Dashboard section
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('secDashboard').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item')[0].classList.add('active');

  // User info
  document.getElementById('sideAvatar').textContent = currentUser.slice(0, 2).toUpperCase();
  document.getElementById('sideUser').textContent = currentUser;

  const today = fmtDate(todayStr());
  document.getElementById('dashDate').textContent = today;
  document.getElementById('logDate').textContent = today;

  renderDashboard();
}

/* ─── RENDER DASHBOARD ───────────────────── */
function renderDashboard() {
  const data = getUserData();
  const entries = data ? (data.entries || []) : [];
  const today = entries.find(e => e.date === todayStr());

  // Stat cards
  document.getElementById('todaySteps').textContent   = today ? Number(today.steps   || 0).toLocaleString() : '—';
  document.getElementById('todayCal').textContent     = today ? (today.calories || 0) : '—';
  document.getElementById('todayWater').textContent   = today ? (today.water    || 0) : '—';
  document.getElementById('todayWorkout').textContent = today ? (today.workout  || 0) : '—';

  // Streak
  const dateSet = new Set(entries.map(e => e.date));
  let streak = 0;
  let check = todayStr();
  while (dateSet.has(check)) {
    streak++;
    check = prevDay(check);
  }
  document.getElementById('streakNum').textContent = streak;
}

/* ─── SAVE DATA ──────────────────────────── */
async function saveData() {
  const steps    = parseInt(document.getElementById('steps').value)      || 0;
  const calories = parseInt(document.getElementById('calories').value)   || 0;
  const distance = parseFloat(document.getElementById('distance').value) || 0;
  const water    = parseFloat(document.getElementById('water').value)    || 0;
  const workout  = parseInt(document.getElementById('workout').value)    || 0;

  if (!steps && !calories && !distance && !water && !workout) {
    showToast('Please enter at least one value.');
    return;
  }

  const today = todayStr();
  const entry = { date: today, steps, calories, distance, water, workout };

  try {
    const result = await apiFetch('/entries', {
      method: 'POST',
      body: JSON.stringify({ username: currentUser, entry })
    });

    setUserData({ ...currentUserData, entries: result.entries });
    ['steps', 'calories', 'distance', 'water', 'workout'].forEach(id =>
      document.getElementById(id).value = ''
    );

    showToast('Entry saved successfully!');
    renderDashboard();
  } catch (err) {
    showToast(err.message || 'Unable to save entry.');
  }
}

/* ─── RENDER PROGRESS CHARTS ─────────────── */
function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); charts[key] = null; }
}

function makeChart(canvasId, type, labels, datasets, options = {}) {
  const canvas = document.getElementById(canvasId);
  return new Chart(canvas, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#6b7280',
            font: { family: 'Inter', size: 11 },
            boxWidth: 10, padding: 12
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#9ca3af', font: { family: 'Inter', size: 11 } },
          grid:  { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#9ca3af', font: { family: 'Inter', size: 11 } },
          grid:  { color: '#f3f4f6' }
        }
      },
      ...options
    }
  });
}

function renderProgressCharts(entries) {
  destroyChart('progress');
  destroyChart('water');
  destroyChart('dist');

  const recent = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const labels = recent.map(e => shortDate(e.date));

  // Main chart
  const mainCanvas = document.getElementById('chartProgress');
  const progressEmpty = document.getElementById('progressEmpty');

  if (!recent.length) {
    mainCanvas.style.display = 'none';
    progressEmpty.style.display = 'block';
  } else {
    mainCanvas.style.display = 'block';
    progressEmpty.style.display = 'none';
    charts['progress'] = makeChart('chartProgress', 'bar', labels, [
      {
        label: 'Steps / 100',
        data: recent.map(e => +((e.steps || 0) / 100).toFixed(1)),
        backgroundColor: 'rgba(37,99,235,0.8)',
        borderRadius: 4, borderSkipped: false
      },
      {
        label: 'Calories',
        data: recent.map(e => e.calories || 0),
        backgroundColor: 'rgba(234,88,12,0.8)',
        borderRadius: 4, borderSkipped: false
      },
      {
        label: 'Workout min',
        data: recent.map(e => e.workout || 0),
        backgroundColor: 'rgba(124,58,237,0.8)',
        borderRadius: 4, borderSkipped: false
      }
    ]);
  }

  // Water chart
  const waterCanvas = document.getElementById('chartWater');
  const waterEmpty  = document.getElementById('waterEmpty');
  if (!recent.length) {
    waterCanvas.style.display = 'none';
    waterEmpty.style.display = 'block';
  } else {
    waterCanvas.style.display = 'block';
    waterEmpty.style.display = 'none';
    charts['water'] = makeChart('chartWater', 'line', labels, [{
      label: 'Water (L)',
      data: recent.map(e => e.water || 0),
      borderColor: '#16a34a',
      backgroundColor: 'rgba(22,163,74,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#16a34a'
    }]);
  }

  // Distance chart
  const distCanvas = document.getElementById('chartDist');
  const distEmpty  = document.getElementById('distEmpty');
  if (!recent.length) {
    distCanvas.style.display = 'none';
    distEmpty.style.display = 'block';
  } else {
    distCanvas.style.display = 'block';
    distEmpty.style.display = 'none';
    charts['dist'] = makeChart('chartDist', 'line', labels, [{
      label: 'Distance (km)',
      data: recent.map(e => e.distance || 0),
      borderColor: '#d97706',
      backgroundColor: 'rgba(217,119,6,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#d97706'
    }]);
  }
}

/* ─── RENDER HISTORY TABLE ───────────────── */
function renderHistoryTable(entries) {
  const tbody    = document.getElementById('histBody');
  const empty    = document.getElementById('histEmpty');
  const table    = document.getElementById('histTable');
  const countEl  = document.getElementById('histCount');

  tbody.innerHTML = '';

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  if (!sorted.length) {
    table.style.display = 'none';
    empty.style.display = 'block';
    countEl.textContent = '0 entries';
    return;
  }

  table.style.display = 'table';
  empty.style.display = 'none';
  countEl.textContent = sorted.length + ' ' + (sorted.length === 1 ? 'entry' : 'entries');

  sorted.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${fmtDate(e.date)}</strong></td>
      <td>${Number(e.steps || 0).toLocaleString()}</td>
      <td>${e.calories || 0} kcal</td>
      <td>${e.distance || 0} km</td>
      <td>${e.water || 0} L</td>
      <td>${e.workout || 0} min</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ─── ENTER KEY ──────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('pageSignup').classList.contains('active')) signup();
  if (document.getElementById('pageLogin').classList.contains('active'))  login();
});