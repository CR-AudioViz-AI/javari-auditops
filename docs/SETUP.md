# JAVARI AUDITOPS - SETUP GUIDE
## Quick Setup for Production
## Generated: January 2, 2026 - 3:25 AM EST

---

# STEP 1: GitHub Secrets Configuration

Go to: https://github.com/CR-AudioViz-AI/javari-auditops/settings/secrets/actions

Add these secrets:

```
SUPABASE_URL=[Your Supabase URL]
SUPABASE_SERVICE_KEY=[Get from Supabase dashboard]
AUDIT_USER_EMAIL=auditbot@craudiovizai.com
AUDIT_USER_PASSWORD=[Create in Supabase Auth]
VERCEL_TOKEN=[Your Vercel token]
VERCEL_TEAM_ID=[Your Vercel team ID]
SLACK_WEBHOOK_URL=[Optional - for notifications]
```

---

# STEP 2: Create Audit Bot User in Supabase

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/gfberqarqcqwzjvqjxfk
2. Navigate to Authentication > Users
3. Click "Add User"
4. Enter:
   - Email: auditbot@craudiovizai.com
   - Password: [Secure password - store in GitHub Secrets]
5. After creation, update the user's role:
   ```sql
   UPDATE profiles 
   SET role = 'service_bot' 
   WHERE email = 'auditbot@craudiovizai.com';
   ```

---

# STEP 3: Run Supabase Migration

Go to Supabase SQL Editor and run the contents of:
`packages/db/migrations/0001_init.sql`

This creates 8 tables:
- audit_domains
- audit_runs
- audit_results
- audit_issues
- audit_suppressions
- audit_trends
- audit_fix_packets
- audit_autopilot_actions

---

# STEP 4: Seed Initial Domains

After migration, seed the primary domains:

```sql
INSERT INTO audit_domains (domain, tier, enabled, crawl_budget_pages, crawl_budget_depth, discovery_source) 
VALUES 
  ('craudiovizai.com', 'primary', true, 1200, 8, ARRAY['seed']),
  ('www.craudiovizai.com', 'primary', true, 1200, 8, ARRAY['seed']),
  ('javariverse.com', 'primary', true, 1200, 8, ARRAY['seed']),
  ('www.javariverse.com', 'primary', true, 1200, 8, ARRAY['seed']),
  ('javaribooks.com', 'product', true, 800, 6, ARRAY['seed']),
  ('javaricards.com', 'product', true, 800, 6, ARRAY['seed']),
  ('javariinvoice.com', 'product', true, 800, 6, ARRAY['seed'])
ON CONFLICT (domain) DO NOTHING;
```

---

# STEP 5: Test Manual Run

1. Go to: https://github.com/CR-AudioViz-AI/javari-auditops/actions
2. Click "AuditOps Manual Run"
3. Click "Run workflow"
4. Set:
   - env: prod
   - scope: domain
   - domain: craudiovizai.com
5. Click "Run workflow"
6. Monitor the run

---

# STEP 6: Enable Scheduled Runs

The workflows are already configured for:
- **Nightly Full**: 2 AM UTC (10 PM EST)
- **Hourly Canary**: Every hour
- **Weekly Deep**: Sunday 4 AM UTC

These will start automatically once secrets are configured.

---

# STEP 7: Connect Vercel Deploy Webhook (Optional)

To trigger audits on every deploy:

1. Go to Vercel Dashboard > Project > Settings > Git
2. Add a webhook:
   - URL: `https://api.github.com/repos/CR-AudioViz-AI/javari-auditops/dispatches`
   - Headers: `Authorization: Bearer [YOUR_GITHUB_TOKEN]`
   - Body:
     ```json
     {
       "event_type": "vercel_deploy",
       "client_payload": {
         "domain": "{{VERCEL_URL}}",
         "deployment_url": "{{DEPLOYMENT_URL}}",
         "git_sha": "{{GIT_SHA}}"
       }
     }
     ```

---

# CREDENTIALS SUMMARY

| Service | Key Location |
|---------|--------------|
| GitHub Token | GitHub Settings > Developer > Personal Access Tokens |
| Vercel Token | Vercel Settings > Tokens |
| Vercel Team | Vercel Team Settings |
| Supabase URL | Supabase Dashboard > Project > API |
| Supabase Key | Supabase Dashboard > Project > API > service_role |

**Note:** All credentials should be stored in GitHub Secrets only, never in code.

---

# VERIFICATION CHECKLIST

- [ ] GitHub secrets configured (6 secrets)
- [ ] Audit bot user created in Supabase
- [ ] Migration run (8 tables created)
- [ ] Primary domains seeded
- [ ] Manual test run successful
- [ ] Reports generated in output/
- [ ] Slack notifications working (if configured)

---

# TROUBLESHOOTING

## "Unauthorized" errors
- Check SUPABASE_SERVICE_KEY is correct
- Verify the key starts with `eyJ` (JWT format)

## "Rate limited" errors
- Reduce requests_per_second in domain config
- Add backoff time between requests

## "Auth failed" for protected routes
- Verify auditbot user exists
- Check password is correct in AUDIT_USER_PASSWORD
- Run `pnpm auth:generate` to regenerate auth state

## Builds fail
- Check all dependencies installed: `pnpm install`
- Verify Node version >= 20
- Check Playwright browsers installed

---

*Generated: January 2, 2026 - 3:25 AM EST*
*"Build systems that build systems."*
