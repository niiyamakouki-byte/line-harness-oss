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
    // Month-over-month comparison queries
    friendsThisMonth,
    friendsLastMonth,
    msgsThisMonth,
    msgsLastMonth,
    formsThisMonth,
    formsLastMonth,
    linksThisMonth,
    linksLastMonth,
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
       ORDER BY day ASC`
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
    // Month-over-month: friends
    db.prepare(
      `SELECT COUNT(*) as c FROM friends WHERE created_at >= date('now', 'start of month')`
    ).first<{ c: number }>(),
    db.prepare(
      `SELECT COUNT(*) as c FROM friends WHERE created_at >= date('now', 'start of month', '-1 month') AND created_at < date('now', 'start of month')`
    ).first<{ c: number }>(),
    // Month-over-month: messages
    db.prepare(
      `SELECT COUNT(*) as c FROM messages_log WHERE created_at >= date('now', 'start of month')`
    ).first<{ c: number }>(),
    db.prepare(
      `SELECT COUNT(*) as c FROM messages_log WHERE created_at >= date('now', 'start of month', '-1 month') AND created_at < date('now', 'start of month')`
    ).first<{ c: number }>(),
    // Month-over-month: form submissions
    db.prepare(
      `SELECT COUNT(*) as c FROM form_submissions WHERE created_at >= date('now', 'start of month')`
    ).first<{ c: number }>(),
    db.prepare(
      `SELECT COUNT(*) as c FROM form_submissions WHERE created_at >= date('now', 'start of month', '-1 month') AND created_at < date('now', 'start of month')`
    ).first<{ c: number }>(),
    // Month-over-month: link clicks
    db.prepare(
      `SELECT COUNT(*) as c FROM link_clicks WHERE clicked_at >= date('now', 'start of month')`
    ).first<{ c: number }>(),
    db.prepare(
      `SELECT COUNT(*) as c FROM link_clicks WHERE clicked_at >= date('now', 'start of month', '-1 month') AND clicked_at < date('now', 'start of month')`
    ).first<{ c: number }>(),
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
    monthComparison: {
      friends: { current: friendsThisMonth?.c ?? 0, previous: friendsLastMonth?.c ?? 0 },
      messages: { current: msgsThisMonth?.c ?? 0, previous: msgsLastMonth?.c ?? 0 },
      forms: { current: formsThisMonth?.c ?? 0, previous: formsLastMonth?.c ?? 0 },
      linkClicks: { current: linksThisMonth?.c ?? 0, previous: linksLastMonth?.c ?? 0 },
    },
  });
});

// ============================================================
// CSV Export endpoint
// ============================================================

dashboard.get('/api/dashboard/export', async (c) => {
  const db = c.env.DB;

  // Sanitize CSV fields to prevent spreadsheet formula injection
  // Prefix dangerous characters with a single-quote so Excel/Sheets treats them as text
  const csvSafe = (val: string): string => {
    const s = (val || '').replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
    return s;
  };

  const [friends, messages, links, forms, routes] = await Promise.all([
    db.prepare('SELECT id, display_name, is_following, ref_code, created_at FROM friends ORDER BY created_at DESC').all(),
    db.prepare(
      `SELECT date(created_at) as day, direction, COUNT(*) as cnt FROM messages_log WHERE created_at >= date('now', '-30 days') GROUP BY day, direction ORDER BY day DESC`
    ).all(),
    db.prepare('SELECT name, original_url, click_count FROM tracked_links WHERE is_active = 1 ORDER BY click_count DESC').all(),
    db.prepare(
      `SELECT fs.created_at, fm.name as form_name, f.display_name as friend_name, fs.data FROM form_submissions fs LEFT JOIN friends f ON fs.friend_id = f.id LEFT JOIN forms fm ON fs.form_id = fm.id ORDER BY fs.created_at DESC LIMIT 100`
    ).all(),
    db.prepare('SELECT ref_code, COUNT(*) as cnt FROM friends WHERE ref_code IS NOT NULL GROUP BY ref_code ORDER BY cnt DESC').all(),
  ]);

  const BOM = '\uFEFF';
  let csv = BOM;

  // Friends section
  csv += '--- \u53CB\u3060\u3061\u4E00\u89A7 ---\n';
  csv += 'ID,\u8868\u793A\u540D,\u30D5\u30A9\u30ED\u30FC\u4E2D,\u6D41\u5165\u7D4C\u8DEF,\u767B\u9332\u65E5\n';
  for (const f of friends.results as any[]) {
    csv += `"${csvSafe(f.id)}","${csvSafe(f.display_name)}",${f.is_following ? '\u306F\u3044' : '\u3044\u3044\u3048'},"${csvSafe(f.ref_code)}","${f.created_at}"\n`;
  }

  csv += '\n--- \u30E1\u30C3\u30BB\u30FC\u30B8\u7D71\u8A08\uFF0830\u65E5\u9593\uFF09 ---\n';
  csv += '\u65E5\u4ED8,\u65B9\u5411,\u4EF6\u6570\n';
  for (const m of messages.results as any[]) {
    csv += `"${m.day}","${m.direction === 'incoming' ? '\u53D7\u4FE1' : '\u9001\u4FE1'}",${m.cnt}\n`;
  }

  csv += '\n--- \u30EA\u30F3\u30AF\u30AF\u30EA\u30C3\u30AF ---\n';
  csv += '\u30EA\u30F3\u30AF\u540D,URL,\u30AF\u30EA\u30C3\u30AF\u6570\n';
  for (const l of links.results as any[]) {
    csv += `"${csvSafe(l.name)}","${csvSafe(l.original_url)}",${l.click_count}\n`;
  }

  csv += '\n--- \u30D5\u30A9\u30FC\u30E0\u9001\u4FE1 ---\n';
  csv += '\u65E5\u4ED8,\u30D5\u30A9\u30FC\u30E0\u540D,\u53CB\u3060\u3061\u540D,\u30C7\u30FC\u30BF\n';
  for (const s of forms.results as any[]) {
    csv += `"${s.created_at}","${csvSafe(s.form_name)}","${csvSafe(s.friend_name)}","${csvSafe(s.data)}"\n`;
  }

  csv += '\n--- \u6D41\u5165\u7D4C\u8DEF ---\n';
  csv += '\u7D4C\u8DEF\u30B3\u30FC\u30C9,\u4EBA\u6570\n';
  for (const r of routes.results as any[]) {
    csv += `"${csvSafe(r.ref_code)}",${r.cnt}\n`;
  }

  const now = new Date();
  const filename = `line-dashboard-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
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
<title>LINE Harness - \u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9</title>
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
  --yellow: #eab308;
  --yellow-bg: rgba(234,179,8,.1);
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
  scroll-behavior: smooth;
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
  gap: 10px;
}
.last-updated {
  font-size: 11px;
  color: var(--text3);
  white-space: nowrap;
}
.header-btn {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text2);
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all .15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  white-space: nowrap;
  text-decoration: none;
}
.header-btn:hover { background: var(--border); color: var(--text); transform: translateY(-1px); }
.header-btn:active { transform: translateY(0); }
.header-btn.is-loading .refresh-icon { animation: spin .6s linear infinite; }
.refresh-icon { display: inline-block; transition: transform .15s; }

/* Navigation bar */
.nav-bar {
  background: var(--bg2);
  border-bottom: 1px solid var(--border-light);
  padding: 0 24px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  position: sticky;
  top: 56px;
  z-index: 9;
}
.nav-inner {
  max-width: 1320px;
  margin: 0 auto;
  display: flex;
  gap: 0;
}
.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  color: var(--text3);
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: all .15s;
}
.nav-link:hover {
  color: var(--text2);
  border-bottom-color: var(--surface2);
}
.nav-link.active {
  color: var(--green);
  border-bottom-color: var(--green);
}

.container { max-width: 1320px; margin: 0 auto; padding: 24px; }

/* Highlight card */
.highlight-card {
  background: linear-gradient(135deg, rgba(34,197,94,.08) 0%, rgba(59,130,246,.08) 50%, rgba(168,85,247,.08) 100%);
  border: 1px solid rgba(34,197,94,.2);
  border-radius: var(--radius);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow);
}
.highlight-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.highlight-header h2 {
  font-size: 16px;
  font-weight: 700;
}
.highlight-header .month-label {
  font-size: 12px;
  color: var(--text3);
  margin-left: auto;
}
.highlight-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.highlight-item {
  text-align: center;
}
.highlight-label {
  font-size: 11px;
  color: var(--text3);
  margin-bottom: 4px;
  font-weight: 600;
}
.highlight-value {
  font-size: 24px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.highlight-change {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 600;
  margin-top: 4px;
  padding: 2px 8px;
  border-radius: 999px;
}
.highlight-change.up {
  color: var(--green);
  background: var(--green-bg);
}
.highlight-change.down {
  color: var(--red);
  background: var(--red-bg);
}
.highlight-change.flat {
  color: var(--text3);
  background: rgba(100,116,139,.1);
}

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
.kpi .label { font-size: 12px; color: var(--text3); letter-spacing: .04em; font-weight: 600; }
.kpi .value { font-size: 32px; font-weight: 800; margin-top: 4px; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.kpi .sub { font-size: 12px; color: var(--text2); margin-top: 4px; }

/* Sections */
.section-anchor {
  scroll-margin-top: 110px;
}
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
.card-header h2 { font-size: 13px; font-weight: 700; letter-spacing: .03em; }
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

/* Enhanced message chart with canvas */
.chart-container {
  position: relative;
  width: 100%;
  height: 260px;
}
.chart-container canvas {
  width: 100% !important;
  height: 100% !important;
}
.chart-tooltip {
  position: absolute;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  pointer-events: none;
  opacity: 0;
  transition: opacity .15s;
  z-index: 5;
  box-shadow: var(--shadow-lg);
  white-space: nowrap;
}
.chart-tooltip.visible { opacity: 1; }
.chart-tooltip .tt-date { font-weight: 700; margin-bottom: 4px; color: var(--text); }
.chart-tooltip .tt-row { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.chart-tooltip .tt-dot { width: 8px; height: 8px; border-radius: 50%; }
.chart-tooltip .tt-label { color: var(--text2); }
.chart-tooltip .tt-val { font-weight: 700; margin-left: auto; }

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
  .kpi-grid, .highlight-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .grid-2 { grid-template-columns: 1fr; }
  .container { padding: 16px; }
  .header { padding: 12px 16px; }
  .header h1 { font-size: 16px; }
  .kpi .value { font-size: 26px; }
  .card-body { padding: 16px; }
  .bar-label { min-width: 70px; font-size: 12px; }
  .nav-bar { padding: 0 16px; top: 52px; }
  .nav-link { padding: 8px 12px; font-size: 11px; }
  .section-anchor { scroll-margin-top: 100px; }
  .highlight-value { font-size: 20px; }
  .chart-container { height: 220px; }
}
@media (max-width: 480px) {
  .kpi-grid, .highlight-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .kpi { padding: 14px 16px; }
  .kpi .value { font-size: 22px; }
  .kpi .icon { width: 30px; height: 30px; font-size: 14px; margin-bottom: 8px; }
  .header-actions { margin-left: 0; width: 100%; justify-content: flex-end; flex-wrap: wrap; }
  .last-updated { font-size: 10px; }
  .highlight-value { font-size: 18px; }
  .chart-container { height: 200px; }
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
    <a class="header-btn" id="export-btn" href="#" onclick="exportCSV(event)">&#x1F4E5; CSV\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8</a>
    <button class="header-btn" id="refresh-btn" onclick="loadData()">
      <span class="refresh-icon" id="refresh-icon">&#x21bb;</span>
      \u66F4\u65B0
    </button>
  </div>
</div>

<div class="nav-bar">
  <div class="nav-inner">
    <a class="nav-link active" href="#sec-highlight">&#x2728; \u30CF\u30A4\u30E9\u30A4\u30C8</a>
    <a class="nav-link" href="#sec-kpi">&#x1F4CA; KPI</a>
    <a class="nav-link" href="#sec-messages">&#x1F4AC; \u30E1\u30C3\u30BB\u30FC\u30B8</a>
    <a class="nav-link" href="#sec-friends">&#x1F465; \u53CB\u3060\u3061</a>
    <a class="nav-link" href="#sec-links">&#x1F517; \u30EA\u30F3\u30AF</a>
    <a class="nav-link" href="#sec-routes">&#x1F6A9; \u6D41\u5165\u7D4C\u8DEF</a>
    <a class="nav-link" href="#sec-forms">&#x1F4CB; \u30D5\u30A9\u30FC\u30E0</a>
    <a class="nav-link" href="#sec-scenarios">&#x1F3AF; \u30B7\u30CA\u30EA\u30AA</a>
  </div>
</div>

<div class="container">
  <!-- Highlight -->
  <div id="sec-highlight" class="section-anchor">
    <div class="highlight-card" id="highlight-card">
      <div class="highlight-header">
        <span>&#x1F4C8;</span>
        <h2>\u4ECA\u6708\u306E\u30CF\u30A4\u30E9\u30A4\u30C8</h2>
        <span class="month-label" id="highlight-month"></span>
      </div>
      <div class="highlight-grid" id="highlight-grid">
        <div class="highlight-item">
          <div class="highlight-label">\u65B0\u898F\u53CB\u3060\u3061</div>
          <div class="highlight-value" id="hl-friends">--</div>
          <div class="highlight-change flat" id="hl-friends-change">-- \u524D\u6708\u6BD4</div>
        </div>
        <div class="highlight-item">
          <div class="highlight-label">\u30E1\u30C3\u30BB\u30FC\u30B8\u6570</div>
          <div class="highlight-value" id="hl-messages">--</div>
          <div class="highlight-change flat" id="hl-messages-change">-- \u524D\u6708\u6BD4</div>
        </div>
        <div class="highlight-item">
          <div class="highlight-label">\u30D5\u30A9\u30FC\u30E0\u9001\u4FE1</div>
          <div class="highlight-value" id="hl-forms">--</div>
          <div class="highlight-change flat" id="hl-forms-change">-- \u524D\u6708\u6BD4</div>
        </div>
        <div class="highlight-item">
          <div class="highlight-label">\u30EA\u30F3\u30AF\u30AF\u30EA\u30C3\u30AF</div>
          <div class="highlight-value" id="hl-links">--</div>
          <div class="highlight-change flat" id="hl-links-change">-- \u524D\u6708\u6BD4</div>
        </div>
      </div>
    </div>
  </div>

  <!-- KPI -->
  <div id="sec-kpi" class="section-anchor">
    <div class="kpi-grid" id="kpi">
      <div class="kpi">
        <div class="icon">&#x1F465;</div>
        <div class="label">\u7DCF\u53CB\u3060\u3061\u6570</div>
        <div class="value" id="kpi-total">--</div>
        <div class="sub">\u767B\u9332\u30E6\u30FC\u30B6\u30FC</div>
      </div>
      <div class="kpi">
        <div class="icon">&#x2705;</div>
        <div class="label">\u30D5\u30A9\u30ED\u30FC\u4E2D</div>
        <div class="value" id="kpi-following">--</div>
        <div class="sub" id="kpi-follow-rate">-- \u30D5\u30A9\u30ED\u30FC\u7387</div>
      </div>
      <div class="kpi">
        <div class="icon">&#x1F517;</div>
        <div class="label">\u6D41\u5165\u7D4C\u8DEF</div>
        <div class="value" id="kpi-routes">--</div>
        <div class="sub">\u30E6\u30CB\u30FC\u30AF\u7D4C\u8DEF\u6570</div>
      </div>
      <div class="kpi">
        <div class="icon">&#x1F4E2;</div>
        <div class="label">\u914D\u4FE1</div>
        <div class="value" id="kpi-broadcasts">--</div>
        <div class="sub" id="kpi-broadcast-sub">-- \u9001\u4FE1\u6E08\u307F</div>
      </div>
    </div>
  </div>

  <!-- Row 1: Messages + Recent Friends -->
  <div class="grid-2">
    <div id="sec-messages" class="section-anchor card">
      <div class="card-header">
        <h2>\u30E1\u30C3\u30BB\u30FC\u30B8\uFF0814\u65E5\u9593\uFF09</h2>
        <div class="legend" style="margin-left:auto">
          <span><span class="dot dot-blue"></span>\u53D7\u4FE1</span>
          <span><span class="dot dot-green"></span>\u9001\u4FE1</span>
        </div>
      </div>
      <div class="card-body" id="messages-chart">
        <div class="loading"><div class="spinner"></div><div class="loading-text">\u8AAD\u307F\u8FBC\u307F\u4E2D...</div></div>
      </div>
    </div>
    <div id="sec-friends" class="section-anchor card">
      <div class="card-header"><h2>\u6700\u65B0\u306E\u53CB\u3060\u3061</h2><span class="count" id="friends-count">--</span></div>
      <div class="card-body" id="recent-friends">
        <div class="loading"><div class="spinner"></div><div class="loading-text">\u8AAD\u307F\u8FBC\u307F\u4E2D...</div></div>
      </div>
    </div>
  </div>

  <!-- Row 2: Link Clicks + Entry Routes -->
  <div class="grid-2">
    <div id="sec-links" class="section-anchor card">
      <div class="card-header"><h2>\u30EA\u30F3\u30AF\u30AF\u30EA\u30C3\u30AF\u5206\u6790</h2></div>
      <div class="card-body" id="link-clicks">
        <div class="loading"><div class="spinner"></div><div class="loading-text">\u8AAD\u307F\u8FBC\u307F\u4E2D...</div></div>
      </div>
    </div>
    <div id="sec-routes" class="section-anchor card">
      <div class="card-header"><h2>\u6D41\u5165\u7D4C\u8DEF</h2></div>
      <div class="card-body" id="entry-routes">
        <div class="loading"><div class="spinner"></div><div class="loading-text">\u8AAD\u307F\u8FBC\u307F\u4E2D...</div></div>
      </div>
    </div>
  </div>

  <!-- Row 3: Form Submissions + Scenarios -->
  <div class="grid-2">
    <div id="sec-forms" class="section-anchor card">
      <div class="card-header"><h2>\u30D5\u30A9\u30FC\u30E0\u9001\u4FE1</h2></div>
      <div class="card-body" id="form-subs">
        <div class="loading"><div class="spinner"></div><div class="loading-text">\u8AAD\u307F\u8FBC\u307F\u4E2D...</div></div>
      </div>
    </div>
    <div id="sec-scenarios" class="section-anchor card">
      <div class="card-header"><h2>\u30A2\u30AF\u30C6\u30A3\u30D6\u30B7\u30CA\u30EA\u30AA</h2></div>
      <div class="card-body" id="scenarios">
        <div class="loading"><div class="spinner"></div><div class="loading-text">\u8AAD\u307F\u8FBC\u307F\u4E2D...</div></div>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  LINE Harness CRM \u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9 &mdash; \u30C7\u30FC\u30BF\u306F\u624B\u52D5\u66F4\u65B0
</div>

<script>
const API_KEY = new URLSearchParams(location.search).get('key') || '';
let isLoading = false;
let cachedData = null;

async function fetchStats() {
  const headers = {};
  if (API_KEY) headers['Authorization'] = 'Bearer ' + API_KEY;
  const res = await fetch('/api/dashboard/stats', { headers });
  if (!res.ok) throw new Error('API ' + res.status + ': ' + (res.statusText || '\u4E0D\u660E\u306A\u30A8\u30E9\u30FC'));
  return res.json();
}

function num(n) { return (n ?? 0).toLocaleString(); }
function shortDate(d) {
  if (!d) return '';
  const clean = d.replace(/T.*/, '');
  const parts = clean.split('-');
  if (parts.length === 3) return parseInt(parts[1]) + '/' + parseInt(parts[2]);
  return clean;
}
function jpDate(d) {
  if (!d) return '';
  const clean = d.replace(/T.*/, '');
  const parts = clean.split('-');
  if (parts.length === 3) return parseInt(parts[1]) + '\u6708' + parseInt(parts[2]) + '\u65E5';
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
  document.getElementById('last-updated').textContent = '\u66F4\u65B0: ' + h + ':' + m + ':' + s;
}

function emptyState(icon, text) {
  return '<div class="empty-state fade-in"><div class="empty-icon">' + icon + '</div><div class="empty-text">' + escHtml(text) + '</div></div>';
}

function errorState(msg) {
  return '<div class="error-state fade-in"><div class="error-icon">!</div><div class="error-text">' + escHtml(msg) + '</div><button class="error-retry" onclick="loadData()">\u518D\u8A66\u884C</button></div>';
}

function exportCSV(e) {
  e.preventDefault();
  const url = '/api/dashboard/export' + (API_KEY ? '?key=' + encodeURIComponent(API_KEY) : '');
  window.open(url, '_blank');
}

// ---------- Navigation scroll spy ----------
function initScrollSpy() {
  const links = document.querySelectorAll('.nav-link');
  const sections = [];
  links.forEach(function(link) {
    const id = link.getAttribute('href').replace('#', '');
    const sec = document.getElementById(id);
    if (sec) sections.push({ id: id, el: sec, link: link });
  });

  var ticking = false;
  window.addEventListener('scroll', function() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function() {
      var scrollY = window.scrollY + 130;
      var active = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].el.offsetTop <= scrollY) active = sections[i];
      }
      links.forEach(function(l) { l.classList.remove('active'); });
      if (active) active.link.classList.add('active');
      ticking = false;
    });
  });
}

// ---------- Highlight card ----------
function renderHighlight(mc) {
  var now = new Date();
  document.getElementById('highlight-month').textContent = now.getFullYear() + '\u5E74' + (now.getMonth() + 1) + '\u6708';

  var items = [
    { elVal: 'hl-friends', elChg: 'hl-friends-change', cur: mc.friends.current, prev: mc.friends.previous },
    { elVal: 'hl-messages', elChg: 'hl-messages-change', cur: mc.messages.current, prev: mc.messages.previous },
    { elVal: 'hl-forms', elChg: 'hl-forms-change', cur: mc.forms.current, prev: mc.forms.previous },
    { elVal: 'hl-links', elChg: 'hl-links-change', cur: mc.linkClicks.current, prev: mc.linkClicks.previous },
  ];

  items.forEach(function(item) {
    document.getElementById(item.elVal).textContent = num(item.cur);
    var changeEl = document.getElementById(item.elChg);
    if (item.prev === 0 && item.cur === 0) {
      changeEl.className = 'highlight-change flat';
      changeEl.textContent = '\u2015 \u524D\u6708\u30C7\u30FC\u30BF\u306A\u3057';
    } else if (item.prev === 0) {
      changeEl.className = 'highlight-change up';
      changeEl.innerHTML = '&#x25B2; \u65B0\u898F';
    } else {
      var pct = Math.round((item.cur - item.prev) / item.prev * 100);
      if (pct > 0) {
        changeEl.className = 'highlight-change up';
        changeEl.innerHTML = '&#x25B2; +' + pct + '% \u524D\u6708\u6BD4';
      } else if (pct < 0) {
        changeEl.className = 'highlight-change down';
        changeEl.innerHTML = '&#x25BC; ' + pct + '% \u524D\u6708\u6BD4';
      } else {
        changeEl.className = 'highlight-change flat';
        changeEl.textContent = '\u2015 \u524D\u6708\u3068\u540C\u7B49';
      }
    }
  });
}

// ---------- KPI ----------
function renderKPI(data) {
  document.getElementById('kpi-total').textContent = num(data.friends.total);
  document.getElementById('kpi-following').textContent = num(data.friends.following);
  var rate = data.friends.total > 0 ? Math.round(data.friends.following / data.friends.total * 100) : 0;
  document.getElementById('kpi-follow-rate').textContent = rate + '% \u30D5\u30A9\u30ED\u30FC\u7387';
  document.getElementById('kpi-routes').textContent = num(data.entryRoutes.length);

  var bTotal = data.broadcasts.reduce(function(s, b) { return s + b.cnt; }, 0);
  var bSent = (data.broadcasts.find(function(b) { return b.status === 'sent'; }) || {}).cnt || 0;
  document.getElementById('kpi-broadcasts').textContent = num(bTotal);
  document.getElementById('kpi-broadcast-sub').textContent = num(bSent) + ' \u9001\u4FE1\u6E08\u307F';
}

// ---------- Messages Chart (Canvas) ----------
function renderMessages(msgs) {
  var el = document.getElementById('messages-chart');
  if (!msgs.length) { el.innerHTML = emptyState('&#x1F4AC;', '\u904E\u53BB14\u65E5\u9593\u306E\u30E1\u30C3\u30BB\u30FC\u30B8\u306A\u3057'); return; }

  var days = {};
  var dayOrder = [];

  // Build a complete 14-day sequence so zero-activity days are visible
  var today = new Date();
  for (var di = 13; di >= 0; di--) {
    var dt = new Date(today);
    dt.setDate(dt.getDate() - di);
    var key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    days[key] = { incoming: 0, outgoing: 0 };
    dayOrder.push(key);
  }

  // Overlay actual data onto the full range
  for (var i = 0; i < msgs.length; i++) {
    var m = msgs[i];
    if (!days[m.day]) { days[m.day] = { incoming: 0, outgoing: 0 }; dayOrder.push(m.day); }
    days[m.day][m.direction] = m.cnt;
  }

  el.innerHTML = '<div class="chart-container fade-in"><canvas id="msg-canvas"></canvas><div class="chart-tooltip" id="msg-tooltip"><div class="tt-date"></div><div class="tt-row"><span class="tt-dot" style="background:var(--blue)"></span><span class="tt-label">\u53D7\u4FE1</span><span class="tt-val" id="tt-in">0</span></div><div class="tt-row"><span class="tt-dot" style="background:var(--green)"></span><span class="tt-label">\u9001\u4FE1</span><span class="tt-val" id="tt-out">0</span></div></div></div>';

  var canvas = document.getElementById('msg-canvas');
  var ctx = canvas.getContext('2d');
  var tooltip = document.getElementById('msg-tooltip');

  function drawChart() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    var W = rect.width;
    var H = rect.height;

    var padLeft = 50, padRight = 20, padTop = 20, padBottom = 40;
    var chartW = W - padLeft - padRight;
    var chartH = H - padTop - padBottom;

    ctx.clearRect(0, 0, W, H);

    // Data arrays
    var inData = dayOrder.map(function(d) { return days[d].incoming; });
    var outData = dayOrder.map(function(d) { return days[d].outgoing; });
    var maxVal = Math.max(1, Math.max.apply(null, inData), Math.max.apply(null, outData));
    // Round up to nice number
    var niceMax = Math.ceil(maxVal / 5) * 5;
    if (niceMax < 5) niceMax = 5;

    // Grid lines + Y axis labels
    ctx.strokeStyle = 'rgba(71,85,105,.3)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    var gridSteps = 5;
    for (var g = 0; g <= gridSteps; g++) {
      var y = padTop + chartH - (g / gridSteps * chartH);
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      var label = Math.round(niceMax / gridSteps * g);
      ctx.fillText(label + '\u4EF6', padLeft - 8, y);
    }

    // X axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var n = dayOrder.length;
    var barGroupW = chartW / n;
    for (var xi = 0; xi < n; xi++) {
      var x = padLeft + xi * barGroupW + barGroupW / 2;
      ctx.fillText(shortDate(dayOrder[xi]), x, padTop + chartH + 8);
      // Thin vertical grid
      ctx.strokeStyle = 'rgba(71,85,105,.15)';
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + chartH);
      ctx.stroke();
    }

    // Draw bars
    var barW = Math.max(4, barGroupW * 0.3);
    var gap = 3;
    for (var bi = 0; bi < n; bi++) {
      var cx = padLeft + bi * barGroupW + barGroupW / 2;
      var inH = (inData[bi] / niceMax) * chartH;
      var outH = (outData[bi] / niceMax) * chartH;

      // Incoming bar (blue)
      var grad1 = ctx.createLinearGradient(0, padTop + chartH - inH, 0, padTop + chartH);
      grad1.addColorStop(0, '#60a5fa');
      grad1.addColorStop(1, '#3b82f6');
      ctx.fillStyle = grad1;
      roundedRect(ctx, cx - barW - gap / 2, padTop + chartH - inH, barW, inH, 3);

      // Outgoing bar (green)
      var grad2 = ctx.createLinearGradient(0, padTop + chartH - outH, 0, padTop + chartH);
      grad2.addColorStop(0, '#4ade80');
      grad2.addColorStop(1, '#22c55e');
      ctx.fillStyle = grad2;
      roundedRect(ctx, cx + gap / 2, padTop + chartH - outH, barW, outH, 3);
    }

    // Baseline
    ctx.strokeStyle = 'rgba(71,85,105,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + chartH);
    ctx.lineTo(padLeft + chartW, padTop + chartH);
    ctx.stroke();

    // Store hit areas for tooltip
    canvas._chartData = { padLeft: padLeft, padTop: padTop, chartW: chartW, chartH: chartH, barGroupW: barGroupW, n: n, dayOrder: dayOrder, days: days };
  }

  function roundedRect(ctx, x, y, w, h, r) {
    if (h <= 0) return;
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  function showTooltip(mx, my) {
    var cd = canvas._chartData;
    if (!cd) return;
    var idx = Math.floor((mx - cd.padLeft) / cd.barGroupW);
    if (idx >= 0 && idx < cd.n && mx >= cd.padLeft && mx <= cd.padLeft + cd.chartW && my >= cd.padTop && my <= cd.padTop + cd.chartH) {
      var day = cd.dayOrder[idx];
      var d = cd.days[day];
      tooltip.querySelector('.tt-date').textContent = jpDate(day);
      document.getElementById('tt-in').textContent = num(d.incoming);
      document.getElementById('tt-out').textContent = num(d.outgoing);
      tooltip.classList.add('visible');
      var rect = canvas.getBoundingClientRect();
      var tx = mx + 16;
      var ty = my - 40;
      if (tx + 160 > rect.width) tx = mx - 170;
      if (ty < 0) ty = 10;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
    } else {
      tooltip.classList.remove('visible');
    }
  }

  canvas.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    showTooltip(e.clientX - rect.left, e.clientY - rect.top);
  });
  canvas.addEventListener('mouseleave', function() {
    tooltip.classList.remove('visible');
  });
  // Touch support for mobile
  canvas.addEventListener('touchstart', function(e) {
    var touch = e.touches[0];
    var rect = canvas.getBoundingClientRect();
    showTooltip(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: true });
  canvas.addEventListener('touchmove', function(e) {
    var touch = e.touches[0];
    var rect = canvas.getBoundingClientRect();
    showTooltip(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: true });
  canvas.addEventListener('touchend', function() {
    setTimeout(function() { tooltip.classList.remove('visible'); }, 2000);
  });

  drawChart();
  // Remove previous resize listener to avoid memory leaks on refresh
  if (window._dashboardResizeHandler) window.removeEventListener('resize', window._dashboardResizeHandler);
  window._dashboardResizeHandler = drawChart;
  window.addEventListener('resize', drawChart);
}

// ---------- Recent Friends ----------
function renderRecentFriends(friends) {
  var el = document.getElementById('recent-friends');
  var countEl = document.getElementById('friends-count');
  countEl.textContent = friends.length;
  if (!friends.length) { el.innerHTML = emptyState('&#x1F464;', '\u307E\u3060\u53CB\u3060\u3061\u304C\u3044\u307E\u305B\u3093'); return; }

  var html = '<div class="fade-in">';
  for (var i = 0; i < friends.length; i++) {
    var f = friends[i];
    var initials = (f.display_name || '?').slice(0, 1).toUpperCase();
    html += '<div class="friend-row">';
    html += '<div class="friend-avatar">';
    if (f.picture_url) {
      html += '<img src="' + escHtml(f.picture_url) + '" alt="" loading="lazy" onerror="this.style.display=\\'none\\';this.parentElement.textContent=\\'' + escHtml(initials) + '\\'">';
    } else {
      html += escHtml(initials);
    }
    html += '</div>';
    html += '<div class="friend-info"><div class="friend-name">' + escHtml(f.display_name || '\u4E0D\u660E') + '</div>';
    html += '<div class="friend-date">' + escHtml(shortDate(f.created_at)) + '</div></div>';
    if (f.ref_code) html += '<span class="friend-ref">' + escHtml(f.ref_code) + '</span>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ---------- Link Clicks ----------
function renderLinks(links) {
  var el = document.getElementById('link-clicks');
  if (!links.length) { el.innerHTML = emptyState('&#x1F517;', '\u30C8\u30E9\u30C3\u30AD\u30F3\u30B0\u30EA\u30F3\u30AF\u306A\u3057'); return; }

  var maxClicks = Math.max(1, Math.max.apply(null, links.map(function(l) { return l.click_count; })));
  var html = '<div class="fade-in">';
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    var pct = Math.max(2, Math.round(l.click_count / maxClicks * 100));
    html += '<div class="bar-row">';
    html += '<span class="bar-label" title="' + escHtml(l.original_url) + '">' + escHtml(truncate(l.name, 20)) + '</span>';
    html += '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:linear-gradient(90deg,var(--blue),#60a5fa)"></div></div>';
    html += '<span class="bar-value">' + num(l.click_count) + '</span>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ---------- Entry Routes ----------
function renderEntryRoutes(routes) {
  var el = document.getElementById('entry-routes');
  if (!routes.length) { el.innerHTML = emptyState('&#x1F6A9;', '\u6D41\u5165\u7D4C\u8DEF\u306E\u8A18\u9332\u306A\u3057'); return; }

  var maxCnt = Math.max(1, Math.max.apply(null, routes.map(function(r) { return r.cnt; })));
  var gradients = [
    'linear-gradient(90deg,var(--purple),#c084fc)',
    'linear-gradient(90deg,var(--orange),#fb923c)',
    'linear-gradient(90deg,var(--pink),#f472b6)',
    'linear-gradient(90deg,var(--cyan),#22d3ee)',
    'linear-gradient(90deg,var(--green),#4ade80)',
    'linear-gradient(90deg,var(--blue),#60a5fa)',
  ];
  var html = '<div class="fade-in">';
  for (var i = 0; i < routes.length; i++) {
    var r = routes[i];
    var pct = Math.max(2, Math.round(r.cnt / maxCnt * 100));
    var bg = gradients[i % gradients.length];
    html += '<div class="bar-row">';
    html += '<span class="bar-label">' + escHtml(r.ref_code) + '</span>';
    html += '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + bg + '"></div></div>';
    html += '<span class="bar-value">' + num(r.cnt) + '</span>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ---------- Form Submissions ----------
function renderFormSubmissions(subs) {
  var el = document.getElementById('form-subs');
  if (!subs.length) { el.innerHTML = emptyState('&#x1F4CB;', '\u30D5\u30A9\u30FC\u30E0\u9001\u4FE1\u306A\u3057'); return; }

  var html = '<div class="fade-in">';
  for (var i = 0; i < subs.length; i++) {
    var s = subs[i];
    var dataStr = '';
    try {
      var d = typeof s.data === 'string' ? JSON.parse(s.data) : s.data;
      dataStr = Object.entries(d).map(function(e) { return e[0] + ': ' + e[1]; }).join(' | ');
    } catch(ex) { dataStr = s.data || ''; }

    html += '<div class="sub-item">';
    html += '<div class="sub-header">';
    html += '<span class="sub-form">' + escHtml(s.form_name || '\u30D5\u30A9\u30FC\u30E0') + '</span>';
    html += '<span class="sub-friend">' + escHtml(s.friend_name || '\u533F\u540D') + '</span>';
    html += '<span class="sub-date">' + escHtml(shortDate(s.created_at)) + '</span>';
    html += '</div>';
    html += '<div class="sub-data">' + escHtml(truncate(dataStr, 100)) + '</div>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ---------- Scenarios ----------
function renderScenarios(scenarios) {
  var el = document.getElementById('scenarios');
  if (!scenarios.length) { el.innerHTML = emptyState('&#x1F3AF;', '\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u30B7\u30CA\u30EA\u30AA\u306A\u3057'); return; }

  var html = '<div class="tbl-wrap fade-in"><table class="tbl"><thead><tr><th>\u30B7\u30CA\u30EA\u30AA</th><th>\u5B9F\u884C\u4E2D</th><th>\u5B8C\u4E86</th><th>\u5408\u8A08</th></tr></thead><tbody>';
  for (var i = 0; i < scenarios.length; i++) {
    var s = scenarios[i];
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

// ---------- Load Data ----------
async function loadData() {
  if (isLoading) return;
  isLoading = true;

  var btn = document.getElementById('refresh-btn');
  btn.classList.add('is-loading');
  btn.disabled = true;

  try {
    var data = await fetchStats();
    cachedData = data;
    renderHighlight(data.monthComparison);
    renderKPI(data);
    renderMessages(data.messages);
    renderRecentFriends(data.friends.recent);
    renderLinks(data.links);
    renderEntryRoutes(data.entryRoutes);
    renderFormSubmissions(data.formSubmissions);
    renderScenarios(data.scenarios);
    updateTimestamp();
  } catch (err) {
    console.error('\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC:', err);
    var sections = ['messages-chart', 'recent-friends', 'link-clicks', 'entry-routes', 'form-subs', 'scenarios'];
    sections.forEach(function(id) {
      var el = document.getElementById(id);
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

initScrollSpy();
loadData();
</script>

</body>
</html>`;

export { dashboard };
