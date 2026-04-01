import { Hono } from 'hono';
import type { Env } from '../index.js';

const dashboard = new Hono<Env>();

// ============================================================
// Dashboard API — JSON endpoints consumed by the HTML page
// ============================================================

dashboard.get('/api/dashboard/stats', async (c) => {
  const db = c.env.DB;

  const [
    friendCount,
    followingCount,
    recentFriends,
    msgByDay,
    linkClicks,
    formSubmissions,
    refBreakdown,
    scenarioStats,
    broadcastStats,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as c FROM friends').first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) as c FROM friends WHERE is_following = 1').first<{ c: number }>(),
    db.prepare(
      `SELECT id, display_name, picture_url, created_at, ref_code
       FROM friends ORDER BY created_at DESC LIMIT 10`
    ).all(),
    db.prepare(
      `SELECT date(created_at) as day, direction, COUNT(*) as cnt
       FROM messages_log
       WHERE created_at >= date('now', '-14 days')
       GROUP BY day, direction
       ORDER BY day DESC`
    ).all(),
    db.prepare(
      `SELECT tl.id, tl.name, tl.original_url, tl.click_count,
              (SELECT COUNT(*) FROM link_clicks lc WHERE lc.tracked_link_id = tl.id AND lc.clicked_at >= date('now', '-7 days')) as recent_clicks
       FROM tracked_links tl
       WHERE tl.is_active = 1
       ORDER BY tl.click_count DESC
       LIMIT 20`
    ).all(),
    db.prepare(
      `SELECT fs.id, fs.form_id, fs.friend_id, fs.data, fs.created_at,
              f.display_name as friend_name, fm.name as form_name
       FROM form_submissions fs
       LEFT JOIN friends f ON fs.friend_id = f.id
       LEFT JOIN forms fm ON fs.form_id = fm.id
       ORDER BY fs.created_at DESC
       LIMIT 20`
    ).all(),
    db.prepare(
      `SELECT ref_code, COUNT(*) as cnt
       FROM friends
       WHERE ref_code IS NOT NULL
       GROUP BY ref_code
       ORDER BY cnt DESC
       LIMIT 20`
    ).all(),
    db.prepare(
      `SELECT s.name,
              COUNT(CASE WHEN fs.status = 'active' THEN 1 END) as active,
              COUNT(CASE WHEN fs.status = 'completed' THEN 1 END) as completed,
              COUNT(*) as total
       FROM scenarios s
       LEFT JOIN friend_scenarios fs ON s.id = fs.scenario_id
       WHERE s.is_active = 1
       GROUP BY s.id
       ORDER BY total DESC
       LIMIT 10`
    ).all(),
    db.prepare(
      `SELECT status, COUNT(*) as cnt FROM broadcasts GROUP BY status`
    ).all(),
  ]);

  return c.json({
    friends: {
      total: friendCount?.c ?? 0,
      following: followingCount?.c ?? 0,
      recent: recentFriends.results,
    },
    messages: msgByDay.results,
    links: linkClicks.results,
    formSubmissions: formSubmissions.results,
    entryRoutes: refBreakdown.results,
    scenarios: scenarioStats.results,
    broadcasts: broadcastStats.results,
  });
});

// ============================================================
// Dashboard HTML — single page with inline CSS + JS
// ============================================================

dashboard.get('/dashboard', async (c) => {
  return c.html(DASHBOARD_HTML);
});

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LINE Harness - Dashboard</title>
<style>
:root {
  --bg: #0a0f1a;
  --bg2: #0f172a;
  --surface: #1e293b;
  --surface2: #334155;
  --border: rgba(71,85,105,.5);
  --border-light: rgba(71,85,105,.25);
  --text: #f1f5f9;
  --text2: #94a3b8;
  --text3: #64748b;
  --green: #22c55e;
  --green-bg: rgba(34,197,94,.1);
  --blue: #3b82f6;
  --blue-bg: rgba(59,130,246,.1);
  --purple: #a855f7;
  --purple-bg: rgba(168,85,247,.1);
  --orange: #f97316;
  --orange-bg: rgba(249,115,22,.1);
  --pink: #ec4899;
  --pink-bg: rgba(236,72,153,.1);
  --cyan: #06b6d4;
  --cyan-bg: rgba(6,182,212,.1);
  --red: #ef4444;
  --red-bg: rgba(239,68,68,.1);
  --radius: 12px;
  --shadow: 0 1px 3px rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.2);
  --shadow-lg: 0 4px 12px rgba(0,0,0,.4);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}

/* Header */
.header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 14px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: var(--shadow-lg);
  flex-wrap: wrap;
}
.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-logo {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, var(--green), #16a34a);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 14px;
  color: #fff;
  flex-shrink: 0;
}
.header h1 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -.02em;
}
.header .badge {
  background: var(--green-bg);
  color: var(--green);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid rgba(34,197,94,.2);
}
.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.last-updated {
  font-size: 11px;
  color: var(--text3);
  white-space: nowrap;
}
.header .refresh {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text2);
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all .15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  white-space: nowrap;
}
.header .refresh:hover { background: var(--border); color: var(--text); transform: translateY(-1px); }
.header .refresh:active { transform: translateY(0); }
.header .refresh.is-loading .refresh-icon { animation: spin .6s linear infinite; }
.refresh-icon { display: inline-block; transition: transform .15s; }

.container { max-width: 1320px; margin: 0 auto; padding: 24px; }

/* KPI cards */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}
.kpi {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 22px;
  box-shadow: var(--shadow);
  transition: transform .15s ease, box-shadow .15s ease;
  position: relative;
  overflow: hidden;
}
.kpi:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.kpi::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}
.kpi:nth-child(1)::before { background: linear-gradient(90deg, var(--green), #16a34a); }
.kpi:nth-child(2)::before { background: linear-gradient(90deg, var(--blue), #2563eb); }
.kpi:nth-child(3)::before { background: linear-gradient(90deg, var(--purple), #7c3aed); }
.kpi:nth-child(4)::before { background: linear-gradient(90deg, var(--orange), #ea580c); }
.kpi .icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  margin-bottom: 12px;
}
.kpi:nth-child(1) .icon { background: var(--green-bg); color: var(--green); }
.kpi:nth-child(2) .icon { background: var(--blue-bg); color: var(--blue); }
.kpi:nth-child(3) .icon { background: var(--purple-bg); color: var(--purple); }
.kpi:nth-child(4) .icon { background: var(--orange-bg); color: var(--orange); }
.kpi .label { font-size: 12px; color: var(--text3); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
.kpi .value { font-size: 32px; font-weight: 800; margin-top: 4px; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.kpi .sub { font-size: 12px; color: var(--text2); margin-top: 4px; }

/* Sections */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
  transition: box-shadow .15s ease;
}
.card:hover { box-shadow: var(--shadow-lg); }
.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15,23,42,.4);
}
.card-header h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.card-header .count {
  margin-left: auto;
  background: var(--surface2);
  color: var(--text2);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
}
.card-body { padding: 20px; }

/* Tables */
.tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th {
  text-align: left;
  padding: 8px 12px;
  color: var(--text3);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .04em;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.tbl td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}
.tbl tr:last-child td { border-bottom: none; }
.tbl tr:hover td { background: rgba(255,255,255,.02); }

/* Bar chart rows */
.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.bar-row:last-child { margin-bottom: 0; }
.bar-label { min-width: 100px; font-size: 13px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar-track { flex: 1; height: 26px; background: var(--bg2); border-radius: 6px; overflow: hidden; position: relative; }
.bar-fill { height: 100%; border-radius: 6px; transition: width .6s cubic-bezier(.4,0,.2,1); min-width: 2px; position: relative; }
.bar-fill::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(180deg, rgba(255,255,255,.08) 0%, transparent 100%);
  border-radius: inherit;
}
.bar-value { min-width: 44px; text-align: right; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }

/* Message chart */
.msg-chart { display: flex; flex-direction: column; gap: 6px; }
.msg-day { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 3px 0; border-radius: 4px; transition: background .1s; }
.msg-day:hover { background: rgba(255,255,255,.02); }
.msg-day .day-label { min-width: 80px; color: var(--text3); font-variant-numeric: tabular-nums; font-size: 12px; }
.msg-bars { flex: 1; display: flex; gap: 2px; height: 22px; }
.msg-bar-in { background: linear-gradient(90deg, var(--blue), #60a5fa); border-radius: 4px; height: 100%; transition: width .6s cubic-bezier(.4,0,.2,1); }
.msg-bar-out { background: linear-gradient(90deg, var(--green), #4ade80); border-radius: 4px; height: 100%; transition: width .6s cubic-bezier(.4,0,.2,1); }
.msg-counts { font-size: 11px; color: var(--text3); min-width: 70px; text-align: right; font-variant-numeric: tabular-nums; }

/* Friend list */
.friend-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-light); transition: background .1s; }
.friend-row:last-child { border-bottom: none; }
.friend-row:hover { background: rgba(255,255,255,.015); margin: 0 -20px; padding-left: 20px; padding-right: 20px; }
.friend-avatar {
  width: 36px; height: 36px; border-radius: 50%; background: var(--surface2);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: var(--text2);
  overflow: hidden; flex-shrink: 0;
  border: 2px solid var(--border-light);
}
.friend-avatar img { width: 100%; height: 100%; object-fit: cover; }
.friend-info { flex: 1; min-width: 0; }
.friend-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.friend-date { font-size: 11px; color: var(--text3); }
.friend-ref {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--purple-bg);
  color: var(--purple);
  font-weight: 600;
  border: 1px solid rgba(168,85,247,.15);
}

/* Submission list */
.sub-item { padding: 12px 0; border-bottom: 1px solid var(--border-light); }
.sub-item:last-child { border-bottom: none; }
.sub-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.sub-form { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--cyan-bg); color: var(--cyan); font-weight: 600; border: 1px solid rgba(6,182,212,.15); }
.sub-friend { font-size: 13px; font-weight: 600; }
.sub-date { font-size: 11px; color: var(--text3); margin-left: auto; }
.sub-data { font-size: 12px; color: var(--text2); line-height: 1.5; }

/* Loading & Empty states */
.loading { text-align: center; padding: 48px 20px; color: var(--text3); }
.loading .spinner {
  display: inline-block;
  width: 28px; height: 28px;
  border: 3px solid var(--surface2);
  border-top-color: var(--blue);
  border-radius: 50%;
  animation: spin .6s linear infinite;
  margin-bottom: 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 13px; }
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text3);
}
.empty-icon { font-size: 28px; margin-bottom: 8px; opacity: .5; }
.empty-text { font-size: 13px; }

/* Error state */
.error-state {
  text-align: center;
  padding: 32px 20px;
  color: var(--red);
  background: var(--red-bg);
  border-radius: 8px;
  margin: 8px;
}
.error-icon { font-size: 24px; margin-bottom: 8px; }
.error-text { font-size: 13px; }
.error-retry {
  margin-top: 12px;
  background: transparent;
  border: 1px solid var(--red);
  color: var(--red);
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: all .15s;
}
.error-retry:hover { background: var(--red); color: #fff; }

/* Color dots & legend */
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.dot-blue { background: var(--blue); }
.dot-green { background: var(--green); }
.legend { display: flex; gap: 16px; font-size: 11px; color: var(--text2); }

/* Footer */
.footer {
  text-align: center;
  padding: 24px;
  color: var(--text3);
  font-size: 11px;
  border-top: 1px solid var(--border-light);
  margin-top: 16px;
}

/* Fade-in animation for content */
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.fade-in { animation: fadeIn .3s ease forwards; }

/* Responsive */
@media (max-width: 1024px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .grid-2 { grid-template-columns: 1fr; }
  .container { padding: 16px; }
  .header { padding: 12px 16px; }
  .header h1 { font-size: 16px; }
  .kpi .value { font-size: 26px; }
  .card-body { padding: 16px; }
  .bar-label { min-width: 70px; font-size: 12px; }
  .msg-day .day-label { min-width: 60px; font-size: 11px; }
  .msg-counts { min-width: 55px; font-size: 10px; }
}
@media (max-width: 480px) {
  .kpi-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .kpi { padding: 14px 16px; }
  .kpi .value { font-size: 22px; }
  .kpi .icon { width: 30px; height: 30px; font-size: 14px; margin-bottom: 8px; }
  .header-actions { margin-left: 0; width: 100%; justify-content: space-between; }
  .last-updated { font-size: 10px; }
}
</style>
</head>
<body>

<div class="header">
  <div class="header-brand">
    <div class="header-logo">L</div>
    <h1>LINE Harness</h1>
    <span class="badge">CRM</span>
  </div>
  <div class="header-actions">
    <span class="last-updated" id="last-updated"></span>
    <button class="refresh" id="refresh-btn" onclick="loadData()">
      <span class="refresh-icon" id="refresh-icon">&#x21bb;</span>
      Refresh
    </button>
  </div>
</div>

<div class="container">
  <!-- KPI -->
  <div class="kpi-grid" id="kpi">
    <div class="kpi">
      <div class="icon">&#x1F465;</div>
      <div class="label">Total Friends</div>
      <div class="value" id="kpi-total">--</div>
      <div class="sub">registered users</div>
    </div>
    <div class="kpi">
      <div class="icon">&#x2705;</div>
      <div class="label">Following</div>
      <div class="value" id="kpi-following">--</div>
      <div class="sub" id="kpi-follow-rate">-- follow rate</div>
    </div>
    <div class="kpi">
      <div class="icon">&#x1F517;</div>
      <div class="label">Entry Routes</div>
      <div class="value" id="kpi-routes">--</div>
      <div class="sub">unique ref codes</div>
    </div>
    <div class="kpi">
      <div class="icon">&#x1F4E2;</div>
      <div class="label">Broadcasts</div>
      <div class="value" id="kpi-broadcasts">--</div>
      <div class="sub" id="kpi-broadcast-sub">-- sent</div>
    </div>
  </div>

  <!-- Row 1: Messages + Recent Friends -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <h2>Messages (14 days)</h2>
        <div class="legend" style="margin-left:auto">
          <span><span class="dot dot-blue"></span>Incoming</span>
          <span><span class="dot dot-green"></span>Outgoing</span>
        </div>
      </div>
      <div class="card-body" id="messages-chart">
        <div class="loading"><div class="spinner"></div><div class="loading-text">Loading...</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h2>Recent Friends</h2><span class="count" id="friends-count">--</span></div>
      <div class="card-body" id="recent-friends">
        <div class="loading"><div class="spinner"></div><div class="loading-text">Loading...</div></div>
      </div>
    </div>
  </div>

  <!-- Row 2: Link Clicks + Entry Routes -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h2>Link Click Analytics</h2></div>
      <div class="card-body" id="link-clicks">
        <div class="loading"><div class="spinner"></div><div class="loading-text">Loading...</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h2>Entry Routes</h2></div>
      <div class="card-body" id="entry-routes">
        <div class="loading"><div class="spinner"></div><div class="loading-text">Loading...</div></div>
      </div>
    </div>
  </div>

  <!-- Row 3: Form Submissions + Scenarios -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h2>Form Submissions</h2></div>
      <div class="card-body" id="form-subs">
        <div class="loading"><div class="spinner"></div><div class="loading-text">Loading...</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h2>Active Scenarios</h2></div>
      <div class="card-body" id="scenarios">
        <div class="loading"><div class="spinner"></div><div class="loading-text">Loading...</div></div>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  LINE Harness CRM Dashboard &mdash; Data refreshes on demand
</div>

<script>
const API_KEY = new URLSearchParams(location.search).get('key') || '';
let isLoading = false;

async function fetchStats() {
  const headers = {};
  if (API_KEY) headers['Authorization'] = 'Bearer ' + API_KEY;
  const res = await fetch('/api/dashboard/stats', { headers });
  if (!res.ok) throw new Error('API ' + res.status + ': ' + (res.statusText || 'Unknown error'));
  return res.json();
}

function num(n) { return (n ?? 0).toLocaleString(); }
function shortDate(d) {
  if (!d) return '';
  const clean = d.replace(/T.*/, '');
  const parts = clean.split('-');
  if (parts.length === 3) return parts[1] + '/' + parts[2];
  return clean;
}
function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n) + '...' : (s || '');
}
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function updateTimestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('last-updated').textContent = 'Updated ' + h + ':' + m + ':' + s;
}

function emptyState(icon, text) {
  return '<div class="empty-state fade-in"><div class="empty-icon">' + icon + '</div><div class="empty-text">' + escHtml(text) + '</div></div>';
}

function errorState(msg) {
  return '<div class="error-state fade-in"><div class="error-icon">!</div><div class="error-text">' + escHtml(msg) + '</div><button class="error-retry" onclick="loadData()">Retry</button></div>';
}

function renderKPI(data) {
  document.getElementById('kpi-total').textContent = num(data.friends.total);
  document.getElementById('kpi-following').textContent = num(data.friends.following);
  const rate = data.friends.total > 0 ? Math.round(data.friends.following / data.friends.total * 100) : 0;
  document.getElementById('kpi-follow-rate').textContent = rate + '% follow rate';
  document.getElementById('kpi-routes').textContent = num(data.entryRoutes.length);

  const bTotal = data.broadcasts.reduce((s, b) => s + b.cnt, 0);
  const bSent = data.broadcasts.find(b => b.status === 'sent')?.cnt || 0;
  document.getElementById('kpi-broadcasts').textContent = num(bTotal);
  document.getElementById('kpi-broadcast-sub').textContent = num(bSent) + ' sent';
}

function renderMessages(msgs) {
  const el = document.getElementById('messages-chart');
  if (!msgs.length) { el.innerHTML = emptyState('&#x1F4AC;', 'No messages in the last 14 days'); return; }

  const days = {};
  for (const m of msgs) {
    if (!days[m.day]) days[m.day] = { incoming: 0, outgoing: 0 };
    days[m.day][m.direction] = m.cnt;
  }

  const maxVal = Math.max(1, ...Object.values(days).map(d => d.incoming + d.outgoing));
  let html = '<div class="msg-chart fade-in">';
  for (const [day, counts] of Object.entries(days)) {
    const inW = Math.max(counts.incoming > 0 ? 2 : 0, Math.round(counts.incoming / maxVal * 100));
    const outW = Math.max(counts.outgoing > 0 ? 2 : 0, Math.round(counts.outgoing / maxVal * 100));
    html += '<div class="msg-day">';
    html += '<span class="day-label">' + escHtml(shortDate(day)) + '</span>';
    html += '<div class="msg-bars" style="flex:1">';
    if (inW > 0) html += '<div class="msg-bar-in" style="width:' + inW + '%" title="Incoming: ' + counts.incoming + '"></div>';
    if (outW > 0) html += '<div class="msg-bar-out" style="width:' + outW + '%" title="Outgoing: ' + counts.outgoing + '"></div>';
    html += '</div>';
    html += '<span class="msg-counts">' + counts.incoming + ' / ' + counts.outgoing + '</span>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderRecentFriends(friends) {
  const el = document.getElementById('recent-friends');
  const countEl = document.getElementById('friends-count');
  countEl.textContent = friends.length;
  if (!friends.length) { el.innerHTML = emptyState('&#x1F464;', 'No friends registered yet'); return; }

  let html = '<div class="fade-in">';
  for (const f of friends) {
    const initials = (f.display_name || '?').slice(0, 1).toUpperCase();
    html += '<div class="friend-row">';
    html += '<div class="friend-avatar">';
    if (f.picture_url) {
      html += '<img src="' + escHtml(f.picture_url) + '" alt="" loading="lazy" onerror="this.style.display=\\'none\\';this.parentElement.textContent=\\'' + escHtml(initials) + '\\'">';
    } else {
      html += escHtml(initials);
    }
    html += '</div>';
    html += '<div class="friend-info"><div class="friend-name">' + escHtml(f.display_name || 'Unknown') + '</div>';
    html += '<div class="friend-date">' + escHtml(shortDate(f.created_at)) + '</div></div>';
    if (f.ref_code) html += '<span class="friend-ref">' + escHtml(f.ref_code) + '</span>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderLinks(links) {
  const el = document.getElementById('link-clicks');
  if (!links.length) { el.innerHTML = emptyState('&#x1F517;', 'No tracked links yet'); return; }

  const maxClicks = Math.max(1, ...links.map(l => l.click_count));
  let html = '<div class="fade-in">';
  for (const l of links) {
    const pct = Math.max(2, Math.round(l.click_count / maxClicks * 100));
    html += '<div class="bar-row">';
    html += '<span class="bar-label" title="' + escHtml(l.original_url) + '">' + escHtml(truncate(l.name, 20)) + '</span>';
    html += '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:linear-gradient(90deg,var(--blue),#60a5fa)"></div></div>';
    html += '<span class="bar-value">' + num(l.click_count) + '</span>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderEntryRoutes(routes) {
  const el = document.getElementById('entry-routes');
  if (!routes.length) { el.innerHTML = emptyState('&#x1F6A9;', 'No ref codes recorded'); return; }

  const maxCnt = Math.max(1, ...routes.map(r => r.cnt));
  const gradients = [
    'linear-gradient(90deg,var(--purple),#c084fc)',
    'linear-gradient(90deg,var(--orange),#fb923c)',
    'linear-gradient(90deg,var(--pink),#f472b6)',
    'linear-gradient(90deg,var(--cyan),#22d3ee)',
    'linear-gradient(90deg,var(--green),#4ade80)',
    'linear-gradient(90deg,var(--blue),#60a5fa)',
  ];
  let html = '<div class="fade-in">';
  routes.forEach((r, i) => {
    const pct = Math.max(2, Math.round(r.cnt / maxCnt * 100));
    const bg = gradients[i % gradients.length];
    html += '<div class="bar-row">';
    html += '<span class="bar-label">' + escHtml(r.ref_code) + '</span>';
    html += '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + bg + '"></div></div>';
    html += '<span class="bar-value">' + num(r.cnt) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function renderFormSubmissions(subs) {
  const el = document.getElementById('form-subs');
  if (!subs.length) { el.innerHTML = emptyState('&#x1F4CB;', 'No form submissions yet'); return; }

  let html = '<div class="fade-in">';
  for (const s of subs) {
    let dataStr = '';
    try {
      const d = typeof s.data === 'string' ? JSON.parse(s.data) : s.data;
      dataStr = Object.entries(d).map(([k, v]) => k + ': ' + v).join(' | ');
    } catch { dataStr = s.data || ''; }

    html += '<div class="sub-item">';
    html += '<div class="sub-header">';
    html += '<span class="sub-form">' + escHtml(s.form_name || 'Form') + '</span>';
    html += '<span class="sub-friend">' + escHtml(s.friend_name || 'Anonymous') + '</span>';
    html += '<span class="sub-date">' + escHtml(shortDate(s.created_at)) + '</span>';
    html += '</div>';
    html += '<div class="sub-data">' + escHtml(truncate(dataStr, 100)) + '</div>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderScenarios(scenarios) {
  const el = document.getElementById('scenarios');
  if (!scenarios.length) { el.innerHTML = emptyState('&#x1F3AF;', 'No active scenarios'); return; }

  let html = '<div class="tbl-wrap fade-in"><table class="tbl"><thead><tr><th>Scenario</th><th>Active</th><th>Completed</th><th>Total</th></tr></thead><tbody>';
  for (const s of scenarios) {
    html += '<tr>';
    html += '<td style="font-weight:600">' + escHtml(truncate(s.name, 28)) + '</td>';
    html += '<td><span style="color:var(--green);font-weight:600">' + num(s.active) + '</span></td>';
    html += '<td><span style="color:var(--blue);font-weight:600">' + num(s.completed) + '</span></td>';
    html += '<td style="font-weight:700">' + num(s.total) + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

async function loadData() {
  if (isLoading) return;
  isLoading = true;

  const btn = document.getElementById('refresh-btn');
  btn.classList.add('is-loading');
  btn.disabled = true;

  try {
    const data = await fetchStats();
    renderKPI(data);
    renderMessages(data.messages);
    renderRecentFriends(data.friends.recent);
    renderLinks(data.links);
    renderEntryRoutes(data.entryRoutes);
    renderFormSubmissions(data.formSubmissions);
    renderScenarios(data.scenarios);
    updateTimestamp();
  } catch (err) {
    console.error('Dashboard load error:', err);
    const sections = ['messages-chart', 'recent-friends', 'link-clicks', 'entry-routes', 'form-subs', 'scenarios'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.querySelector('.loading')) {
        el.innerHTML = errorState(err.message);
      }
    });
  } finally {
    isLoading = false;
    btn.classList.remove('is-loading');
    btn.disabled = false;
  }
}

loadData();
</script>

</body>
</html>`;

export { dashboard };
