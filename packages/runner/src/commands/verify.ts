/**
 * JAVARI AUDITOPS - Verify Fixes Command
 * Re-runs targeted audits to verify fixes
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { runLighthouse } from '../modules/lighthouse';
import { checkSecurityHeaders } from '../modules/security-headers';
import { checkSEO } from '../modules/seo-meta';
import type { AuditIssue, DomainConfig } from '../types';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface VerifyOptions {
  runId: string;
  issueId?: string;
}

export async function verifyFixes(options: VerifyOptions): Promise<void> {
  console.log(chalk.cyan(`Verifying fixes for run: ${options.runId}`));
  
  // Get issues to verify
  let query = supabase
    .from('audit_issues')
    .select('*')
    .eq('run_id', options.runId)
    .eq('status', 'fixing');
  
  if (options.issueId) {
    query = query.eq('id', options.issueId);
  }
  
  const { data: issues, error } = await query;
  
  if (error) {
    console.error(chalk.red('Failed to fetch issues:'), error.message);
    return;
  }
  
  if (!issues || issues.length === 0) {
    console.log(chalk.yellow('No issues in "fixing" status to verify'));
    return;
  }
  
  console.log(chalk.green(`Found ${issues.length} issues to verify`));
  
  // Group issues by domain
  const issuesByDomain = new Map<string, AuditIssue[]>();
  for (const issue of issues) {
    const domainIssues = issuesByDomain.get(issue.domain_id) || [];
    domainIssues.push(issue);
    issuesByDomain.set(issue.domain_id, domainIssues);
  }
  
  let verified = 0;
  let stillPresent = 0;
  
  // Verify each domain
  for (const [domainId, domainIssues] of issuesByDomain) {
    console.log(chalk.yellow(`\n━━━ Verifying domain: ${domainId} ━━━`));
    
    // Get domain config
    const { data: domain } = await supabase
      .from('audit_domains')
      .select('*')
      .eq('id', domainId)
      .single();
    
    if (!domain) {
      console.log(chalk.red(`  Domain not found: ${domainId}`));
      continue;
    }
    
    // Run targeted audits based on issue categories
    const categories = [...new Set(domainIssues.map(i => i.category))];
    const newIssues: AuditIssue[] = [];
    
    for (const category of categories) {
      switch (category) {
        case 'SEO':
          const seoIssues = await checkSEO(domain as DomainConfig, `verify_${options.runId}`);
          newIssues.push(...seoIssues);
          break;
        case 'SECURITY':
          const securityIssues = await checkSecurityHeaders(domain as DomainConfig, `verify_${options.runId}`);
          newIssues.push(...securityIssues);
          break;
        case 'PERF':
        case 'A11Y':
          const lighthouseIssues = await runLighthouse(domain as DomainConfig, `verify_${options.runId}`);
          newIssues.push(...lighthouseIssues);
          break;
      }
    }
    
    // Check if original issues are still present
    const newFingerprints = new Set(newIssues.map(i => i.fingerprint));
    
    for (const issue of domainIssues) {
      const stillExists = newFingerprints.has(issue.fingerprint);
      
      if (stillExists) {
        console.log(chalk.red(`  ❌ Issue still present: ${issue.title}`));
        stillPresent++;
        
        // Update status back to open
        await supabase
          .from('audit_issues')
          .update({ status: 'open' })
          .eq('id', issue.id);
        
      } else {
        console.log(chalk.green(`  ✅ Issue verified fixed: ${issue.title}`));
        verified++;
        
        // Update status to verified
        await supabase
          .from('audit_issues')
          .update({
            status: 'verified',
            verified_at: new Date().toISOString(),
          })
          .eq('id', issue.id);
      }
    }
  }
  
  // Print summary
  console.log(chalk.bold('\n' + '═'.repeat(50)));
  console.log(chalk.bold.cyan('  VERIFICATION SUMMARY'));
  console.log('═'.repeat(50));
  console.log(`  ${chalk.green('✅ Verified Fixed:')} ${verified}`);
  console.log(`  ${chalk.red('❌ Still Present:')} ${stillPresent}`);
  console.log('═'.repeat(50));
  
  if (stillPresent > 0) {
    console.log(chalk.yellow('\n⚠️  Some issues are still present. Fixes may need review.'));
  } else {
    console.log(chalk.green('\n🎉 All issues verified as fixed!'));
  }
}
