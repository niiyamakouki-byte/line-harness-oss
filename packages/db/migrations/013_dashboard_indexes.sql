-- Dashboard performance indexes
-- These indexes support the dashboard stats endpoint which queries
-- friends, messages_log, form_submissions, link_clicks, tracked_links,
-- and friend_scenarios with filters/sorts on columns that previously
-- had no index, causing full table scans.

-- friends: ORDER BY created_at DESC, GROUP BY ref_code
CREATE INDEX IF NOT EXISTS idx_friends_created_at ON friends (created_at);
CREATE INDEX IF NOT EXISTS idx_friends_ref_code ON friends (ref_code) WHERE ref_code IS NOT NULL;

-- messages_log: WHERE created_at >= ... GROUP BY date(created_at), direction
CREATE INDEX IF NOT EXISTS idx_messages_log_created_at ON messages_log (created_at);

-- form_submissions: ORDER BY created_at DESC, WHERE created_at >= ...
CREATE INDEX IF NOT EXISTS idx_form_submissions_created_at ON form_submissions (created_at);

-- link_clicks: WHERE clicked_at >= ..., correlated subquery per tracked_link
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks (clicked_at);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_clicked ON link_clicks (tracked_link_id, clicked_at);

-- tracked_links: WHERE is_active = 1 ORDER BY click_count DESC
CREATE INDEX IF NOT EXISTS idx_tracked_links_active_clicks ON tracked_links (is_active, click_count DESC);

-- friend_scenarios: LEFT JOIN on scenario_id, GROUP BY scenario_id
CREATE INDEX IF NOT EXISTS idx_friend_scenarios_scenario_id ON friend_scenarios (scenario_id);
