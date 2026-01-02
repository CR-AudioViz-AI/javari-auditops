# JAVARI AUDITOPS - OPERATIONS RUNBOOK
## Production Operations Guide
## Version 1.0.0 | January 2, 2026

---

# QUICK REFERENCE

## Common Commands
```bash
# Run audit on single domain
pnpm auditops run --domain craudiovizai.com

# Run full audit
pnpm auditops run --scope full --env prod

# Run by tier
pnpm auditops run --scope tier --tier primary

# Verify specific run
pnpm auditops verify --runId <run-id>

# Generate fix packet
pnpm auditops generate-fix-packet --runId <run-id>
```

## Key URLs
- **Console:** https://auditops.craudiovizai.com
- **GitHub Actions:** https://github.com/CR-AudioViz-AI/javari-auditops/actions
- **Supabase:** https://supabase.com/dashboard/project/gfberqarqcqwzjvqjxfk

---

# 1. RUNNING AUDITS

## 1.1 Manual Audit via GitHub Actions

1. Go to: https://github.com/CR-AudioViz-AI/javari-auditops/actions
2. Click "AuditOps Manual Run"
3. Click "Run workflow"
4. Fill in parameters:
   - `env`: prod or staging
   - `scope`: full, domain, or tier
   - `domain`: (if scope=domain)
   - `tier`: (if scope=tier)
5. Click "Run workflow"
6. Monitor progress in Actions tab

## 1.2 Manual Audit via CLI

```bash
# Install dependencies
pnpm install

# Generate auth state
pnpm --filter @auditops/runner run auth:generate

# Run audit
pnpm auditops run --domain craudiovizai.com --env prod
```

## 1.3 Scheduled Audits

Audits run automatically:
- **Nightly Full:** 2 AM UTC (10 PM EST) - All domains, all modules
- **Hourly Canary:** Every hour - Primary domains, critical modules
- **Weekly Deep:** Sunday 4 AM UTC - Maximum depth crawl

---

# 2. VIEWING RESULTS

## 2.1 Console Dashboard

1. Go to: https://auditops.craudiovizai.com
2. Login with admin credentials
3. View:
   - Latest run status (Go/No-Go)
   - Issue breakdown by severity
   - Worst domains by risk score
   - Trend charts

## 2.2 GitHub Artifacts

1. Go to the completed workflow run
2. Scroll to "Artifacts" section
3. Download `auditops-report-*`
4. Extract and open `report.html`

## 2.3 Supabase Tables

Query directly in Supabase SQL Editor:
```sql
-- Latest runs
SELECT * FROM audit_runs 
ORDER BY created_at DESC 
LIMIT 10;

-- Open blockers
SELECT * FROM audit_issues 
WHERE severity = 'BLOCKER' 
AND status = 'open';

-- Issues by domain
SELECT domain_id, COUNT(*) as issue_count
FROM audit_issues
WHERE status = 'open'
GROUP BY domain_id
ORDER BY issue_count DESC;
```

---

# 3. HANDLING ISSUES

## 3.1 BLOCKER Issues

**Immediate Action Required**

1. Check Slack for alert
2. Open the audit report
3. Review BLOCKER issues
4. Either:
   - Auto-fix if supported
   - Generate fix packet for Claude
   - Escalate to human if critical

## 3.2 Suppressing Issues

For known/acceptable issues:
```sql
INSERT INTO audit_suppressions (fingerprint, reason, created_by, expires_at)
VALUES (
  '<issue-fingerprint>',
  'Known issue - pending platform update',
  'roy@craudiovizai.com',
  NOW() + INTERVAL '30 days'
);
```

## 3.3 Generating Fix Packets

```bash
# Generate for latest run
pnpm auditops generate-fix-packet

# Generate for specific run
pnpm auditops generate-fix-packet --runId <run-id>

# Generate blockers only
pnpm auditops generate-fix-packet --severity BLOCKER
```

---

# 4. MANAGING DOMAINS

## 4.1 Adding a Domain

Via Supabase:
```sql
INSERT INTO audit_domains (domain, tier, enabled, crawl_budget_pages)
VALUES ('newdomain.craudiovizai.com', 'subdomain', true, 600);
```

Via Console:
1. Go to Domains page
2. Click "Add Domain"
3. Fill in details
4. Save

## 4.2 Disabling a Domain

```sql
UPDATE audit_domains 
SET enabled = false 
WHERE domain = 'old-domain.craudiovizai.com';
```

## 4.3 Refreshing Discovery

Via GitHub Actions:
1. Run "AuditOps Manual Run"
2. Check "Refresh Discovery" option

This will:
- Query Vercel API for new projects
- Scan GitHub repos for deploy URLs
- Merge with existing domains
- Add new domains as discovered

---

# 5. TROUBLESHOOTING

## 5.1 Audit Fails to Start

**Check:**
1. GitHub Actions secrets configured?
2. Supabase connection working?
3. Node/pnpm versions correct?

**Fix:**
```bash
# Verify secrets
gh secret list

# Test Supabase connection
curl -H "apikey: $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/rest/v1/audit_domains?limit=1"
```

## 5.2 Crawl Blocked (429 Errors)

**Cause:** Rate limiting triggered

**Fix:**
1. Reduce `requestsPerSecond` in config
2. Increase `backoffMultiplier`
3. Add domain to slower tier

```yaml
# In inventory.yml
domains:
  - domain: sensitive-domain.com
    requests_per_second: 1
    concurrency: 2
```

## 5.3 Auth Issues (Protected Pages)

**Cause:** Audit bot credentials invalid

**Fix:**
1. Verify `AUDIT_USER_EMAIL` and `AUDIT_USER_PASSWORD`
2. Check user exists in Supabase Auth
3. Regenerate auth state:
```bash
pnpm --filter @auditops/runner run auth:generate
```

## 5.4 Lighthouse Timeouts

**Cause:** Page too slow or complex

**Fix:**
1. Increase timeout in config
2. Skip Lighthouse for specific domains:
```bash
pnpm auditops run --domain slow-domain.com --excludeModules lighthouse
```

---

# 6. SECURITY OPERATIONS

## 6.1 Rotating Secrets

**When to rotate:**
- Key exposed in logs
- Key shared externally
- Regular rotation policy (quarterly)

**Steps:**
1. Generate new key in source system
2. Update GitHub Secret
3. Update Vercel env var (if used)
4. Verify with test run
5. Invalidate old key

## 6.2 Reviewing Access Logs

```sql
-- Check autopilot actions
SELECT * FROM audit_autopilot_actions
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check who triggered runs
SELECT triggered_by, COUNT(*) 
FROM audit_runs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY triggered_by;
```

## 6.3 Incident Response

**If sensitive data exposed:**
1. Immediately rotate affected keys
2. Check audit_autopilot_actions for recent changes
3. Review git history for any PRs
4. Notify security team

---

# 7. DEPLOYMENT GATING

## 7.1 Enabling Gating

In `.env` or Vercel:
```
DEPLOYMENT_GATING_ENABLED=true
DEPLOYMENT_GATING_MODE=warn  # or "block"
```

## 7.2 Warn Mode (Default)
- Audit runs after deploy
- Results posted to Slack
- No deploy blocking

## 7.3 Block Mode (Strict)
- Audit runs after deploy
- BLOCKER issues fail the workflow
- Requires manual override to proceed

## 7.4 Overriding a Block

In the failed workflow:
1. Review the blockers
2. If acceptable, re-run with:
```bash
pnpm auditops run --skip-gating
```

---

# 8. MAINTENANCE

## 8.1 Database Cleanup

```sql
-- Delete old runs (keep 90 days)
DELETE FROM audit_runs
WHERE completed_at < NOW() - INTERVAL '90 days';

-- Delete orphaned issues
DELETE FROM audit_issues
WHERE run_id NOT IN (SELECT run_id FROM audit_runs);
```

## 8.2 Artifact Cleanup

GitHub artifacts auto-expire based on workflow config.
Manual cleanup:
```bash
gh run list --workflow audit-scheduled.yml --json databaseId \
  | jq '.[].databaseId' \
  | xargs -I {} gh run delete {}
```

## 8.3 Updating Dependencies

```bash
# Update all
pnpm update

# Update Playwright browsers
pnpm --filter @auditops/runner exec playwright install
```

---

# 9. CONTACTS

| Role | Name | Contact |
|------|------|---------|
| CEO | Roy Henderson | royhenderson@craudiovizai.com |
| CMO | Cindy Henderson | cindyhenderson@craudiovizai.com |
| Platform | Support | info@craudiovizai.com |

---

# 10. GLOSSARY

| Term | Definition |
|------|------------|
| **BLOCKER** | Issue that breaks production functionality |
| **Canary** | Quick health check on critical pages |
| **Fix Packet** | Structured instructions for AI to fix issues |
| **Fingerprint** | Unique hash to track issue across runs |
| **Go/No-Go** | Overall health indicator (GREEN/YELLOW/RED) |
| **Risk Score** | Weighted sum of issues by severity |
| **Suppression** | Marking an issue as acceptable/ignored |

---

*Last Updated: January 2, 2026*
*"Operations excellence is the foundation of reliability."*
