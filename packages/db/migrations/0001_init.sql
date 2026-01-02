-- =============================================================
-- JAVARI AUDITOPS - SUPABASE SCHEMA
-- Version: 1.0.0
-- Created: January 2, 2026
-- =============================================================

-- =============================================================
-- TABLE: audit_domains
-- Purpose: Registry of all domains to audit
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'apps' CHECK (tier IN ('primary', 'product', 'subdomain', 'apps', 'collector')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  crawl_budget_pages INT NOT NULL DEFAULT 500,
  crawl_budget_depth INT NOT NULL DEFAULT 6,
  max_runtime_minutes INT NOT NULL DEFAULT 8,
  requests_per_second NUMERIC NOT NULL DEFAULT 2,
  concurrency INT NOT NULL DEFAULT 4,
  follow_robots_txt BOOLEAN NOT NULL DEFAULT TRUE,
  discovery_source TEXT[] NOT NULL DEFAULT '{}',
  last_audited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE: audit_runs
-- Purpose: Track each audit execution
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  env TEXT NOT NULL DEFAULT 'prod' CHECK (env IN ('prod', 'staging', 'dev')),
  scope TEXT NOT NULL DEFAULT 'full' CHECK (scope IN ('full', 'domain', 'tier')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed', 'cancelled')),
  triggered_by TEXT NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'scheduled', 'deploy', 'api', 'javari')),
  runner_version TEXT,
  git_sha TEXT,
  config_json JSONB NOT NULL DEFAULT '{}',
  total_domains INT NOT NULL DEFAULT 0,
  total_pages INT NOT NULL DEFAULT 0,
  duration_ms BIGINT,
  summary JSONB DEFAULT '{}',
  go_no_go TEXT CHECK (go_no_go IN ('GREEN', 'YELLOW', 'RED')),
  error TEXT
);

-- =============================================================
-- TABLE: audit_results
-- Purpose: Per-domain results for each run
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL REFERENCES audit_runs(run_id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES audit_domains(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'partial', 'failed', 'skipped')),
  pages_crawled INT DEFAULT 0,
  risk_score INT DEFAULT 0,
  metrics_json JSONB NOT NULL DEFAULT '{}',
  lighthouse_json JSONB DEFAULT '{}',
  security_headers_json JSONB DEFAULT '{}',
  artifacts_json JSONB NOT NULL DEFAULT '{}',
  status_code_summary JSONB NOT NULL DEFAULT '{}'
);

-- =============================================================
-- TABLE: audit_issues
-- Purpose: Individual issues detected
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL REFERENCES audit_runs(run_id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES audit_domains(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Classification
  category TEXT NOT NULL CHECK (category IN ('SEO', 'A11Y', 'PERF', 'SECURITY', 'API', 'AUTH', 'UX', 'LINKS')),
  severity TEXT NOT NULL CHECK (severity IN ('BLOCKER', 'HIGH', 'MEDIUM', 'LOW')),
  
  -- Details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  route_or_endpoint TEXT,
  rule_id TEXT,
  signature TEXT,
  
  -- Evidence
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  screenshot_path TEXT,
  har_path TEXT,
  
  -- Fix information
  recommended_fix TEXT,
  auto_fixable BOOLEAN DEFAULT FALSE,
  fixed_by TEXT CHECK (fixed_by IN ('javari', 'claude', 'human')),
  fixed_at TIMESTAMPTZ,
  fix_pr_url TEXT,
  verified_at TIMESTAMPTZ,
  
  -- Tracking
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixing', 'fixed', 'verified', 'suppressed', 'wontfix')),
  first_seen_run_id TEXT,
  last_seen_run_id TEXT,
  occurrence_count INT DEFAULT 1
);

-- =============================================================
-- TABLE: audit_suppressions
-- Purpose: Issues marked as acceptable/ignored
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================
-- TABLE: audit_trends
-- Purpose: Historical trend data for dashboards
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  module TEXT NOT NULL,
  date DATE NOT NULL,
  score_avg DECIMAL(5,2),
  lighthouse_perf DECIMAL(5,2),
  lighthouse_a11y DECIMAL(5,2),
  lighthouse_seo DECIMAL(5,2),
  lighthouse_bp DECIMAL(5,2),
  issues_blocker INT DEFAULT 0,
  issues_high INT DEFAULT 0,
  issues_medium INT DEFAULT 0,
  issues_low INT DEFAULT 0,
  issues_total INT DEFAULT 0,
  pages_crawled INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, module, date)
);

-- =============================================================
-- TABLE: audit_fix_packets
-- Purpose: Generated fix packets for AI processing
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_fix_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL REFERENCES audit_runs(run_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_ai TEXT NOT NULL DEFAULT 'javari' CHECK (target_ai IN ('javari', 'claude', 'both')),
  packet_json JSONB NOT NULL,
  packet_markdown TEXT NOT NULL,
  issues_count INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  processed_by TEXT
);

-- =============================================================
-- TABLE: audit_autopilot_actions
-- Purpose: Track Javari AI autopilot actions
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_autopilot_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issue_id UUID REFERENCES audit_issues(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('auto_fix', 'escalate_claude', 'suppress', 'create_pr', 'verify', 'merge', 'rollback')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'success', 'failed')),
  details JSONB DEFAULT '{}',
  pr_url TEXT,
  error_message TEXT,
  completed_at TIMESTAMPTZ
);

-- =============================================================
-- INDEXES
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_audit_domains_enabled ON audit_domains(enabled);
CREATE INDEX IF NOT EXISTS idx_audit_domains_tier ON audit_domains(tier);

CREATE INDEX IF NOT EXISTS idx_audit_runs_status ON audit_runs(status);
CREATE INDEX IF NOT EXISTS idx_audit_runs_created ON audit_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_runs_env ON audit_runs(env);

CREATE INDEX IF NOT EXISTS idx_audit_results_run ON audit_results(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_domain ON audit_results(domain_id);

CREATE INDEX IF NOT EXISTS idx_audit_issues_run ON audit_issues(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_domain ON audit_issues(domain_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_fingerprint ON audit_issues(fingerprint);
CREATE INDEX IF NOT EXISTS idx_audit_issues_severity ON audit_issues(severity);
CREATE INDEX IF NOT EXISTS idx_audit_issues_status ON audit_issues(status);
CREATE INDEX IF NOT EXISTS idx_audit_issues_category ON audit_issues(category);

CREATE INDEX IF NOT EXISTS idx_audit_trends_domain ON audit_trends(domain);
CREATE INDEX IF NOT EXISTS idx_audit_trends_date ON audit_trends(date DESC);

CREATE INDEX IF NOT EXISTS idx_audit_fix_packets_run ON audit_fix_packets(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_fix_packets_status ON audit_fix_packets(status);

CREATE INDEX IF NOT EXISTS idx_audit_autopilot_issue ON audit_autopilot_actions(issue_id);
CREATE INDEX IF NOT EXISTS idx_audit_autopilot_status ON audit_autopilot_actions(status);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
ALTER TABLE audit_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_fix_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_autopilot_actions ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for runner)
CREATE POLICY "service_role_full_access" ON audit_domains FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_full_access" ON audit_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_full_access" ON audit_results FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_full_access" ON audit_issues FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_full_access" ON audit_suppressions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_full_access" ON audit_trends FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_full_access" ON audit_fix_packets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_full_access" ON audit_autopilot_actions FOR ALL USING (auth.role() = 'service_role');

-- Authenticated admin users can read (for console)
CREATE POLICY "admin_read_access" ON audit_domains FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_read_access" ON audit_runs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_read_access" ON audit_results FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_read_access" ON audit_issues FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_read_access" ON audit_suppressions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_read_access" ON audit_trends FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_read_access" ON audit_fix_packets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_read_access" ON audit_autopilot_actions FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================
-- FUNCTIONS
-- =============================================================

-- Function to calculate risk score for a domain
CREATE OR REPLACE FUNCTION calculate_risk_score(
  p_blocker INT,
  p_high INT,
  p_medium INT,
  p_low INT
) RETURNS INT AS $$
BEGIN
  RETURN (p_blocker * 100) + (p_high * 25) + (p_medium * 5) + (p_low * 1);
END;
$$ LANGUAGE plpgsql;

-- Function to determine go/no-go status
CREATE OR REPLACE FUNCTION determine_go_no_go(
  p_blocker INT,
  p_high INT
) RETURNS TEXT AS $$
BEGIN
  IF p_blocker > 0 THEN
    RETURN 'RED';
  ELSIF p_high > 10 THEN
    RETURN 'YELLOW';
  ELSE
    RETURN 'GREEN';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- SEED PRIMARY DOMAINS
-- =============================================================
INSERT INTO audit_domains (domain, tier, enabled, crawl_budget_pages, crawl_budget_depth, discovery_source) VALUES
  ('craudiovizai.com', 'primary', true, 1200, 8, ARRAY['seed']),
  ('www.craudiovizai.com', 'primary', true, 1200, 8, ARRAY['seed']),
  ('javariverse.com', 'primary', true, 1200, 8, ARRAY['seed']),
  ('www.javariverse.com', 'primary', true, 1200, 8, ARRAY['seed'])
ON CONFLICT (domain) DO NOTHING;

-- =============================================================
-- END OF MIGRATION
-- =============================================================
