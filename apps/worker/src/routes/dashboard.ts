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
  --bg: #0f172a;
  --surface: #1e293b;
  --surface2: #334155;
  --border: #475569;
  --text: #f1f5f9;
  --text2: #94a3b8;
  --text3: #64748b;
  --green: #22c55e;
  --green-bg: rgba(34,197,94,.12);
  --blue: #3b82f6;
  --blue-bg: rgba(59,130,246,.12);
  --purple: #a855f7;
  --purple-bg: rgba(168,85,247,.12);
  --orange: #f97316;
  --orange-bg: rgba(249,115,22,.12);
  --pink: #ec4899;
  --pink-bg: rgba(236,72,153,.12);
  --cyan: #06b6d4;
  --cyan-bg: rgba(6,182,212,.12);
  --radius: 12px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Hiragino Sans', 'Noto Sans JP', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}
.header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 10;
}
.header h1 {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -.02em;
}
.header .badge {
  background: var(--green-bg);
  color: var(--green);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.header .refresh {
  margin-left: auto;
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text2);
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: .15s;
}
.header .refresh:hover { background: var(--border); color: var(--text); }
.container { max-width: 1280px; margin: 0 auto; padding: 24px; }

/* KPI cards */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.kpi {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}
.kpi .label { font-size: 12px; color: var(--text3); text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
.kpi .value { font-size: 32px; font-weight: 800; margin-top: 4px; letter-spacing: -.03em; }
.kpi .sub { font-size: 12px; color: var(--text2); margin-top: 2px; }

/* Sections */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}
@media (max-width: 768px) {
  .grid-2 { grid-template-columns: 1fr; }
  .kpi-grid { grid-template-columns: 1fr 1fr; }
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-header h2 { font-size: 14px; font-weight: 700; }
.card-header .count {
  margin-left: auto;
  background: var(--surface2);
  color: var(--text2);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
}
.card-body { padding: 16px 20px; }

/* Tables */
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
}
.tbl td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(71,85,105,.3);
  vertical-align: middle;
}
.tbl tr:last-child td { border-bottom: none; }
.tbl tr:hover td { background: rgba(255,255,255,.02); }

/* Bar chart rows */
.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.bar-row:last-child { margin-bottom: 0; }
.bar-label { min-width: 100px; font-size: 13px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar-track { flex: 1; height: 24px; background: var(--surface2); border-radius: 6px; overflow: hidden; position: relative; }
.bar-fill { height: 100%; border-radius: 6px; transition: width .5s ease; min-width: 2px; }
.bar-value { min-width: 40px; text-align: right; font-size: 13px; font-weight: 700; }

/* Message chart */
.msg-chart { display: flex; flex-direction: column; gap: 6px; }
.msg-day { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.msg-day .day-label { min-width: 80px; color: var(--text3); font-variant-numeric: tabular-nums; }
.msg-bars { flex: 1; display: flex; gap: 2px; height: 20px; }
.msg-bar-in { background: var(--blue); border-radius: 3px; height: 100%; }
.msg-bar-out { background: var(--green); border-radius: 3px; height: 100%; }

/* Friend list */
.friend-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(71,85,105,.2); }
.friend-row:last-child { border-bottom: none; }
.friend-avatar {
  width: 32px; height: 32px; border-radius: 50%; background: var(--surface2);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: var(--text2);
  overflow: hidden; flex-shrink: 0;
}
.friend-avatar img { width: 100%; height: 100%; object-fit: cover; }
.friend-info { flex: 1; min-width: 0; }
.friend-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.friend-date { font-size: 11px; color: var(--text3); }
.friend-ref {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--purple-bg);
  color: var(--purple);
  font-weight: 600;
}

/* Submission list */
.sub-item { padding: 10px 0; border-bottom: 1px solid rgba(71,85,105,.2); }
.sub-item:last-child { border-bottom: none; }
.sub-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.sub-form { font-size: 12px; padding: 1px 6px; border-radius: 4px; background: var(--cyan-bg); color: var(--cyan); font-weight: 600; }
.sub-friend { font-size: 13px; font-weight: 600; }
.sub-date { font-size: 11px; color: var(--text3); margin-left: auto; }
.sub-data { font-size: 12px; color: var(--text2); }

/* Loading */
.loading { text-align: center; padding: 40px; color: var(--text3); }
.loading .spinner {
  display: inline-block;
  width: 24px; height: 24px;
  border: 3px solid var(--surface2);
  border-top-color: var(--blue);
  border-radius: 50%;
  animation: spin .6s linear infinite;
  margin-bottom: 8px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Color dots */
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.dot-blue { background: var(--blue); }
.dot-green { background: var(--green); }
.legend { display: flex; gap: 16px; font-size: 11px; color: var(--text2); margin-bottom: 8px; }
</style>
</head>
<body>

<div class="header">
  <h1>LINE Harness</h1>
  <span class="badge">CRM Dashboard</span>
  <button class="refresh" onclick="loadData()">Refresh</button>
</div>

<div class="container">
  <!-- KPI -->
  <div class="kpi-grid" id="kpi">
    <div class="kpi"><div class="label">Total Friends</div><div class="value" id="kpi-total">--</div></div>
    <div class="kpi"><div class="label">Following</div><div class="value" id="kpi-following">--</div><div class="sub" id="kpi-follow-rate"></div></div>
    <div class="kpi"><div class="label">Entry Routes</div><div class="value" id="kpi-routes">--</div><div class="sub">unique ref codes</div></div>
    <div class="kpi"><div class="label">Broadcasts</div><div class="value" id="kpi-broadcasts">--</div><div class="sub" id="kpi-broadcast-sub"></div></div>
  </div>

  <!-- Row 1: Messages + Recent Friends -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <h2>Messages (14 days)</h2>
        <div class="legend" style="margin-left:auto;margin-bottom:0">
          <span><span class="dot dot-blue"></span>Incoming</span>
          <span><span class="dot dot-green"></span>Outgoing</span>
        </div>
      </div>
      <div class="card-body" id="messages-chart">
        <div class="loading"><div class="spinner"></div><br>Loading...</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h2>Recent Friends</h2></div>
      <div class="card-body" id="recent-friends">
        <div class="loading"><div class="spinner"></div><br>Loading...</div>
      </div>
    </div>
  </div>

  <!-- Row 2: Link Clicks + Entry Routes -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h2>Link Click Analytics</h2></div>
      <div class="card-body" id="link-clicks">
        <div class="loading"><div class="spinner"></div><br>Loading...</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h2>Entry Routes (ref codes)</h2></div>
      <div class="card-body" id="entry-routes">
        <div class="loading"><div class="spinner"></div><br>Loading...</div>
      </div>
    </div>
  </div>

  <!-- Row 3: Form Submissions + Scenarios -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h2>Recent Form Submissions</h2></div>
      <div class="card-body" id="form-subs">
        <div class="loading"><div class="spinner"></div><br>Loading...</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h2>Active Scenarios</h2></div>
      <div class="card-body" id="scenarios">
        <div class="loading"><div class="spinner"></div><br>Loading...</div>
      </div>
    </div>
  </div>
</div>

<script>
const API_KEY = new URLSearchParams(location.search).get('key') || '';

async function fetchStats() {
  const headers = {};
  if (API_KEY) headers['Authorization'] = 'Bearer ' + API_KEY;
  const res = await fetch('/api/dashboard/stats', { headers });
  if (!res.ok) throw new Error('API error: ' + res.status);
  return res.json();
}

function num(n) { return (n ?? 0).toLocaleString(); }
function shortDate(d) {
  if (!d) return '';
  return d.replace(/T.*/, '').replace(/^\\d{4}-/, '');
}
function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n) + '...' : (s || '');
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
  document.getElementById('kpi-broadcast-sub').textContent = bSent + ' sent';
}

function renderMessages(msgs) {
  const el = document.getElementById('messages-chart');
  if (!msgs.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">No messages yet</div>'; return; }

  // Group by day
  const days = {};
  for (const m of msgs) {
    if (!days[m.day]) days[m.day] = { incoming: 0, outgoing: 0 };
    days[m.day][m.direction] = m.cnt;
  }

  const maxVal = Math.max(1, ...Object.values(days).map(d => Math.max(d.incoming, d.outgoing)));
  let html = '<div class="msg-chart">';
  for (const [day, counts] of Object.entries(days)) {
    const inW = Math.round(counts.incoming / maxVal * 100);
    const outW = Math.round(counts.outgoing / maxVal * 100);
    html += '<div class="msg-day">';
    html += '<span class="day-label">' + shortDate(day) + '</span>';
    html += '<div class="msg-bars" style="flex:1">';
    if (inW > 0) html += '<div class="msg-bar-in" style="width:' + inW + '%" title="In: ' + counts.incoming + '"></div>';
    if (outW > 0) html += '<div class="msg-bar-out" style="width:' + outW + '%" title="Out: ' + counts.outgoing + '"></div>';
    html += '</div>';
    html += '<span style="font-size:11px;color:var(--text3);min-width:60px;text-align:right">' + counts.incoming + ' / ' + counts.outgoing + '</span>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderRecentFriends(friends) {
  const el = document.getElementById('recent-friends');
  if (!friends.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">No friends yet</div>'; return; }

  let html = '';
  for (const f of friends) {
    const initials = (f.display_name || '?').slice(0, 1);
    html += '<div class="friend-row">';
    html += '<div class="friend-avatar">';
    if (f.picture_url) {
      html += '<img src="' + f.picture_url + '" alt="" loading="lazy">';
    } else {
      html += initials;
    }
    html += '</div>';
    html += '<div class="friend-info"><div class="friend-name">' + (f.display_name || 'Unknown') + '</div>';
    html += '<div class="friend-date">' + shortDate(f.created_at) + '</div></div>';
    if (f.ref_code) html += '<span class="friend-ref">' + f.ref_code + '</span>';
    html += '</div>';
  }
  el.innerHTML = html;
}

function renderLinks(links) {
  const el = document.getElementById('link-clicks');
  if (!links.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">No tracked links yet</div>'; return; }

  const maxClicks = Math.max(1, ...links.map(l => l.click_count));
  let html = '';
  for (const l of links) {
    const pct = Math.round(l.click_count / maxClicks * 100);
    html += '<div class="bar-row">';
    html += '<span class="bar-label" title="' + l.original_url + '">' + truncate(l.name, 20) + '</span>';
    html += '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:var(--blue)"></div></div>';
    html += '<span class="bar-value">' + num(l.click_count) + '</span>';
    html += '</div>';
  }
  el.innerHTML = html;
}

function renderEntryRoutes(routes) {
  const el = document.getElementById('entry-routes');
  if (!routes.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">No ref codes recorded</div>'; return; }

  const maxCnt = Math.max(1, ...routes.map(r => r.cnt));
  const colors = ['var(--purple)', 'var(--orange)', 'var(--pink)', 'var(--cyan)', 'var(--green)', 'var(--blue)'];
  let html = '';
  routes.forEach((r, i) => {
    const pct = Math.round(r.cnt / maxCnt * 100);
    const color = colors[i % colors.length];
    html += '<div class="bar-row">';
    html += '<span class="bar-label">' + r.ref_code + '</span>';
    html += '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>';
    html += '<span class="bar-value">' + num(r.cnt) + '</span>';
    html += '</div>';
  });
  el.innerHTML = html;
}

function renderFormSubmissions(subs) {
  const el = document.getElementById('form-subs');
  if (!subs.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">No form submissions yet</div>'; return; }

  let html = '';
  for (const s of subs) {
    let dataStr = '';
    try {
      const d = typeof s.data === 'string' ? JSON.parse(s.data) : s.data;
      dataStr = Object.entries(d).map(([k, v]) => k + ': ' + v).join(' | ');
    } catch { dataStr = s.data || ''; }

    html += '<div class="sub-item">';
    html += '<div class="sub-header">';
    html += '<span class="sub-form">' + (s.form_name || 'Form') + '</span>';
    html += '<span class="sub-friend">' + (s.friend_name || 'Anonymous') + '</span>';
    html += '<span class="sub-date">' + shortDate(s.created_at) + '</span>';
    html += '</div>';
    html += '<div class="sub-data">' + truncate(dataStr, 80) + '</div>';
    html += '</div>';
  }
  el.innerHTML = html;
}

function renderScenarios(scenarios) {
  const el = document.getElementById('scenarios');
  if (!scenarios.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">No active scenarios</div>'; return; }

  let html = '<table class="tbl"><thead><tr><th>Scenario</th><th>Active</th><th>Completed</th><th>Total</th></tr></thead><tbody>';
  for (const s of scenarios) {
    html += '<tr>';
    html += '<td>' + truncate(s.name, 24) + '</td>';
    html += '<td style="color:var(--green)">' + num(s.active) + '</td>';
    html += '<td style="color:var(--blue)">' + num(s.completed) + '</td>';
    html += '<td style="font-weight:700">' + num(s.total) + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}

async function loadData() {
  try {
    const data = await fetchStats();
    renderKPI(data);
    renderMessages(data.messages);
    renderRecentFriends(data.friends.recent);
    renderLinks(data.links);
    renderEntryRoutes(data.entryRoutes);
    renderFormSubmissions(data.formSubmissions);
    renderScenarios(data.scenarios);
  } catch (err) {
    console.error('Dashboard load error:', err);
    document.querySelectorAll('.loading').forEach(el => {
      el.innerHTML = '<div style="color:#ef4444;font-size:13px">Error: ' + err.message + '</div>';
    });
  }
}

loadData();
</script>

</body>
</html>`;

export { dashboard };
