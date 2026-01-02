/**
 * JAVARI AUDITOPS - Type Definitions
 */

export interface AuditOptions {
  env: 'prod' | 'staging' | 'dev';
  scope: 'full' | 'domain' | 'tier';
  domain?: string;
  tier?: 'primary' | 'product' | 'subdomain' | 'apps' | 'collector';
  includeModules?: string;
  excludeModules?: string;
  maxRuntimeMinutes?: string;
  triggeredBy?: 'manual' | 'scheduled' | 'deploy' | 'api' | 'javari';
  crawlBudgetPages?: string;
  crawlBudgetDepth?: string;
}

export interface DomainConfig {
  id: string;
  domain: string;
  tier: 'primary' | 'product' | 'subdomain' | 'apps' | 'collector';
  enabled: boolean;
  crawl_budget_pages: number;
  crawl_budget_depth: number;
  max_runtime_minutes: number;
  requests_per_second: number;
  concurrency: number;
  follow_robots_txt: boolean;
  discovery_source: string[];
  last_audited_at?: string;
}

export interface AuditRun {
  id?: string;
  run_id: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  env: string;
  scope: string;
  status: 'running' | 'complete' | 'failed' | 'cancelled';
  triggered_by: string;
  runner_version?: string;
  git_sha?: string;
  config_json: any;
  total_domains: number;
  total_pages: number;
  duration_ms?: number;
  summary: {
    BLOCKER: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  go_no_go?: 'GREEN' | 'YELLOW' | 'RED';
  error?: string;
}

export interface AuditResult {
  id?: string;
  run_id: string;
  domain_id: string;
  created_at?: string;
  status: 'complete' | 'partial' | 'failed' | 'skipped';
  pages_crawled: number;
  risk_score: number;
  metrics_json: any;
  lighthouse_json?: any;
  security_headers_json?: any;
  artifacts_json: any;
  status_code_summary: Record<number, number>;
}

export interface AuditIssue {
  id?: string;
  run_id: string;
  domain_id: string;
  created_at?: string;
  updated_at?: string;
  
  // Classification
  category: 'SEO' | 'A11Y' | 'PERF' | 'SECURITY' | 'API' | 'AUTH' | 'UX' | 'LINKS';
  severity: 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'LOW';
  
  // Details
  title: string;
  description: string;
  route_or_endpoint?: string;
  rule_id?: string;
  signature?: string;
  
  // Evidence
  evidence_urls: string[];
  screenshot_path?: string;
  har_path?: string;
  
  // Fix information
  recommended_fix?: string;
  auto_fixable: boolean;
  fixed_by?: 'javari' | 'claude' | 'human';
  fixed_at?: string;
  fix_pr_url?: string;
  verified_at?: string;
  
  // Tracking
  fingerprint: string;
  status: 'open' | 'fixing' | 'fixed' | 'verified' | 'suppressed' | 'wontfix';
  first_seen_run_id?: string;
  last_seen_run_id?: string;
  occurrence_count: number;
}

export interface AuditSuppression {
  id?: string;
  fingerprint: string;
  reason: string;
  created_by?: string;
  created_at?: string;
  expires_at?: string;
  is_active: boolean;
}

export interface AuditTrend {
  id?: string;
  domain: string;
  module: string;
  date: string;
  score_avg?: number;
  lighthouse_perf?: number;
  lighthouse_a11y?: number;
  lighthouse_seo?: number;
  lighthouse_bp?: number;
  issues_blocker: number;
  issues_high: number;
  issues_medium: number;
  issues_low: number;
  issues_total: number;
  pages_crawled: number;
}

export interface FixPacket {
  runId: string;
  generatedAt: string;
  generatedBy: 'javari-auditops';
  targetAI: 'javari' | 'claude' | 'both';
  summary: {
    BLOCKER: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    autoFixable: number;
  };
  issues: FixPacketIssue[];
}

export interface FixPacketIssue {
  id: string;
  fingerprint: string;
  severity: string;
  category: string;
  domain: string;
  route_or_endpoint?: string;
  title: string;
  description: string;
  evidence_urls: string[];
  recommended_fix?: string;
  acceptance_criteria: string[];
  verification: string[];
  rollback: string[];
  autoFixable: boolean;
  fixedBy?: string;
  fixedAt?: string;
  verifiedAt?: string;
}

export interface CrawlResult {
  url: string;
  status: number;
  redirects: string[];
  links: string[];
  images: string[];
  consoleErrors: string[];
  loadTime: number;
  lighthouse?: LighthouseResult;
}

export interface LighthouseResult {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
  pwa?: number;
}

export interface SecurityHeadersResult {
  headers: Record<string, string | undefined>;
  missing: string[];
  weak: string[];
  score: number;
}

export type AuditModuleId = 
  | 'crawlLinkIntegrity'
  | 'crawlConsoleErrors'
  | 'seoMeta'
  | 'robotsSitemap'
  | 'lighthouse'
  | 'securityHeaders'
  | 'apiContract'
  | 'rbac';

export interface AuditModule {
  id: AuditModuleId;
  name: string;
  category: AuditIssue['category'];
  run(domain: DomainConfig, runId: string): Promise<AuditIssue[]>;
}
