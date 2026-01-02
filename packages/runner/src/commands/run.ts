/**
 * JAVARI AUDITOPS - Run Audit Command
 * Orchestrates the full audit process
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import crypto from 'crypto';
import { crawlDomain } from '../crawl/crawler';
import { runLighthouse } from '../modules/lighthouse';
import { checkSecurityHeaders } from '../modules/security-headers';
import { checkSEO } from '../modules/seo-meta';
import { generateReport } from '../reporting/report-generator';
import { getDomains } from '../config/domains';
import type { AuditOptions, AuditRun, AuditIssue, DomainConfig } from '../types';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function runAudit(options: AuditOptions): Promise<void> {
  const runId = `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const startTime = Date.now();
  
  console.log(chalk.cyan(`Run ID: ${runId}`));
  console.log('');
  
  // Create run record
  const run: AuditRun = {
    run_id: runId,
    env: options.env,
    scope: options.scope,
    status: 'running',
    triggered_by: options.triggeredBy || 'manual',
    started_at: new Date().toISOString(),
    config_json: options,
    total_domains: 0,
    total_pages: 0,
    summary: {
      BLOCKER: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    },
  };
  
  // Save run to database
  await saveRun(run);
  
  // Get domains to audit
  const domains = await getDomains(options);
  run.total_domains = domains.length;
  
  console.log(chalk.green(`Found ${domains.length} domains to audit`));
  console.log('');
  
  const allIssues: AuditIssue[] = [];
  const results: Map<string, any> = new Map();
  
  // Process each domain
  for (const domain of domains) {
    console.log(chalk.yellow(`\n━━━ Auditing: ${domain.domain} ━━━`));
    
    try {
      const domainIssues = await auditDomain(domain, runId, options);
      allIssues.push(...domainIssues);
      
      // Update summary
      for (const issue of domainIssues) {
        run.summary[issue.severity as keyof typeof run.summary]++;
      }
      
      results.set(domain.domain, {
        status: 'complete',
        issues: domainIssues.length,
        pages: domain.crawl_budget_pages,
      });
      
      console.log(chalk.green(`  ✅ Complete - ${domainIssues.length} issues found`));
      
    } catch (error) {
      console.log(chalk.red(`  ❌ Failed: ${error}`));
      results.set(domain.domain, {
        status: 'failed',
        error: String(error),
      });
    }
  }
  
  // Calculate go/no-go
  const goNoGo = determineGoNoGo(run.summary);
  
  // Update run record
  run.status = 'complete';
  run.completed_at = new Date().toISOString();
  run.duration_ms = Date.now() - startTime;
  run.go_no_go = goNoGo;
  
  await saveRun(run);
  
  // Save issues to database
  await saveIssues(allIssues);
  
  // Generate reports
  console.log(chalk.cyan('\n━━━ Generating Reports ━━━'));
  await generateReport(run, allIssues, results);
  
  // Print summary
  printSummary(run, allIssues);
}

async function auditDomain(
  domain: DomainConfig,
  runId: string,
  options: AuditOptions
): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const modules = parseModules(options);
  
  // 1. Crawl for link integrity
  if (modules.includes('crawlLinkIntegrity')) {
    console.log(chalk.gray('  → Crawling for link integrity...'));
    const crawlIssues = await crawlDomain(domain, runId);
    issues.push(...crawlIssues);
  }
  
  // 2. Run Lighthouse
  if (modules.includes('lighthouse')) {
    console.log(chalk.gray('  → Running Lighthouse...'));
    const lighthouseIssues = await runLighthouse(domain, runId);
    issues.push(...lighthouseIssues);
  }
  
  // 3. Check security headers
  if (modules.includes('securityHeaders')) {
    console.log(chalk.gray('  → Checking security headers...'));
    const headerIssues = await checkSecurityHeaders(domain, runId);
    issues.push(...headerIssues);
  }
  
  // 4. Check SEO meta
  if (modules.includes('seoMeta')) {
    console.log(chalk.gray('  → Checking SEO meta tags...'));
    const seoIssues = await checkSEO(domain, runId);
    issues.push(...seoIssues);
  }
  
  return issues;
}

function parseModules(options: AuditOptions): string[] {
  const defaultModules = [
    'crawlLinkIntegrity',
    'lighthouse',
    'securityHeaders',
    'seoMeta',
  ];
  
  let modules = [...defaultModules];
  
  if (options.includeModules) {
    modules = options.includeModules.split(',').map(m => m.trim());
  }
  
  if (options.excludeModules) {
    const exclude = options.excludeModules.split(',').map(m => m.trim());
    modules = modules.filter(m => !exclude.includes(m));
  }
  
  return modules;
}

function determineGoNoGo(summary: Record<string, number>): 'GREEN' | 'YELLOW' | 'RED' {
  if (summary.BLOCKER > 0) return 'RED';
  if (summary.HIGH > 10) return 'YELLOW';
  return 'GREEN';
}

async function saveRun(run: AuditRun): Promise<void> {
  const { error } = await supabase
    .from('audit_runs')
    .upsert(run, { onConflict: 'run_id' });
  
  if (error) {
    console.error(chalk.red('Failed to save run:'), error.message);
  }
}

async function saveIssues(issues: AuditIssue[]): Promise<void> {
  if (issues.length === 0) return;
  
  const { error } = await supabase
    .from('audit_issues')
    .insert(issues);
  
  if (error) {
    console.error(chalk.red('Failed to save issues:'), error.message);
  }
}

function printSummary(run: AuditRun, issues: AuditIssue[]): void {
  const goNoGoEmoji = run.go_no_go === 'GREEN' ? '🟢' : run.go_no_go === 'YELLOW' ? '🟡' : '🔴';
  
  console.log(chalk.bold('\n' + '═'.repeat(60)));
  console.log(chalk.bold.cyan('  AUDIT SUMMARY'));
  console.log('═'.repeat(60));
  console.log('');
  console.log(`  ${goNoGoEmoji} Go/No-Go: ${chalk.bold(run.go_no_go)}`);
  console.log('');
  console.log(`  📊 Issues by Severity:`);
  console.log(`     ${chalk.red('BLOCKER')}: ${run.summary.BLOCKER}`);
  console.log(`     ${chalk.yellow('HIGH')}:    ${run.summary.HIGH}`);
  console.log(`     ${chalk.blue('MEDIUM')}:  ${run.summary.MEDIUM}`);
  console.log(`     ${chalk.gray('LOW')}:     ${run.summary.LOW}`);
  console.log('');
  console.log(`  ⏱️  Duration: ${(run.duration_ms! / 1000).toFixed(1)}s`);
  console.log(`  🌐 Domains:  ${run.total_domains}`);
  console.log(`  🐛 Total Issues: ${issues.length}`);
  console.log('');
  console.log('═'.repeat(60));
  console.log('');
  console.log(`  📁 Reports saved to: ./output/`);
  console.log(`  📋 Run ID: ${run.run_id}`);
  console.log('');
}
