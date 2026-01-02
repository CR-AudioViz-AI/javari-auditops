/**
 * JAVARI AUDITOPS - Fix Packet Generator
 * Generates structured fix packets for Javari AI / Claude
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import type { AuditIssue, FixPacket, FixPacketIssue } from '../types';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface FixPacketOptions {
  runId?: string;
  severity?: 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'LOW';
  target?: 'javari' | 'claude' | 'both';
}

export async function generateFixPacket(options: FixPacketOptions): Promise<void> {
  const targetAI = options.target || 'javari';
  
  // Get run ID (latest if not specified)
  let runId = options.runId;
  if (!runId) {
    const { data: latestRun } = await supabase
      .from('audit_runs')
      .select('run_id')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!latestRun) {
      console.log(chalk.yellow('No completed audit runs found'));
      return;
    }
    runId = latestRun.run_id;
  }
  
  console.log(chalk.cyan(`Generating fix packet for run: ${runId}`));
  console.log(chalk.gray(`Target AI: ${targetAI}`));
  
  // Fetch issues
  let query = supabase
    .from('audit_issues')
    .select('*')
    .eq('run_id', runId)
    .eq('status', 'open')
    .order('severity', { ascending: true });
  
  if (options.severity) {
    const severityOrder = ['BLOCKER', 'HIGH', 'MEDIUM', 'LOW'];
    const minIndex = severityOrder.indexOf(options.severity);
    const allowedSeverities = severityOrder.slice(0, minIndex + 1);
    query = query.in('severity', allowedSeverities);
  }
  
  const { data: issues, error } = await query;
  
  if (error) {
    console.error(chalk.red('Failed to fetch issues:'), error.message);
    return;
  }
  
  if (!issues || issues.length === 0) {
    console.log(chalk.green('No open issues found for this run'));
    return;
  }
  
  console.log(chalk.green(`Found ${issues.length} issues`));
  
  // Build fix packet
  const packet: FixPacket = {
    runId: runId!,
    generatedAt: new Date().toISOString(),
    generatedBy: 'javari-auditops',
    targetAI,
    summary: {
      BLOCKER: issues.filter((i: AuditIssue) => i.severity === 'BLOCKER').length,
      HIGH: issues.filter((i: AuditIssue) => i.severity === 'HIGH').length,
      MEDIUM: issues.filter((i: AuditIssue) => i.severity === 'MEDIUM').length,
      LOW: issues.filter((i: AuditIssue) => i.severity === 'LOW').length,
      autoFixable: issues.filter((i: AuditIssue) => i.auto_fixable).length,
    },
    issues: issues.map(transformIssue),
  };
  
  // Generate markdown version
  const markdown = generateMarkdown(packet);
  
  // Save to database
  await saveFixPacket(packet, markdown);
  
  // Save to files
  const outputDir = path.join(process.cwd(), 'output');
  await fs.mkdir(outputDir, { recursive: true });
  
  const jsonPath = path.join(outputDir, `fix-packet-${runId}.json`);
  const mdPath = path.join(outputDir, `fix-packet-${runId}.md`);
  
  await fs.writeFile(jsonPath, JSON.stringify(packet, null, 2));
  await fs.writeFile(mdPath, markdown);
  
  console.log(chalk.green('\n✅ Fix packet generated:'));
  console.log(chalk.gray(`   JSON: ${jsonPath}`));
  console.log(chalk.gray(`   Markdown: ${mdPath}`));
  
  // Print summary
  console.log(chalk.cyan('\n📊 Summary:'));
  console.log(`   ${chalk.red('BLOCKER')}: ${packet.summary.BLOCKER}`);
  console.log(`   ${chalk.yellow('HIGH')}:    ${packet.summary.HIGH}`);
  console.log(`   ${chalk.blue('MEDIUM')}:  ${packet.summary.MEDIUM}`);
  console.log(`   ${chalk.gray('LOW')}:     ${packet.summary.LOW}`);
  console.log(`   ${chalk.green('Auto-fixable')}: ${packet.summary.autoFixable}`);
}

function transformIssue(issue: AuditIssue): FixPacketIssue {
  return {
    id: issue.id || '',
    fingerprint: issue.fingerprint,
    severity: issue.severity,
    category: issue.category,
    domain: '', // Will be populated from domain_id lookup
    route_or_endpoint: issue.route_or_endpoint,
    title: issue.title,
    description: issue.description,
    evidence_urls: issue.evidence_urls,
    recommended_fix: issue.recommended_fix,
    acceptance_criteria: generateAcceptanceCriteria(issue),
    verification: generateVerificationSteps(issue),
    rollback: generateRollbackSteps(issue),
    autoFixable: issue.auto_fixable,
  };
}

function generateAcceptanceCriteria(issue: AuditIssue): string[] {
  const criteria: string[] = [];
  
  switch (issue.category) {
    case 'SEO':
      criteria.push('Meta tags are present and correctly formatted');
      criteria.push('No SEO warnings in Lighthouse audit');
      break;
    case 'SECURITY':
      criteria.push('Security header is present in response');
      criteria.push('Header value matches recommended configuration');
      break;
    case 'A11Y':
      criteria.push('WCAG 2.1 AA compliance for affected elements');
      criteria.push('Screen reader compatible');
      break;
    case 'PERF':
      criteria.push('Lighthouse performance score improved');
      criteria.push('Core Web Vitals pass thresholds');
      break;
    case 'LINKS':
      criteria.push('All links return 2xx or 3xx status');
      criteria.push('No 404 errors in crawl');
      break;
    default:
      criteria.push('Issue no longer appears in audit');
  }
  
  return criteria;
}

function generateVerificationSteps(issue: AuditIssue): string[] {
  return [
    `Re-run audit on ${issue.route_or_endpoint || 'affected page'}`,
    `Check that issue fingerprint ${issue.fingerprint} is no longer detected`,
    'Verify no new issues introduced',
  ];
}

function generateRollbackSteps(issue: AuditIssue): string[] {
  return [
    'Revert the commit via `git revert <sha>`',
    'Deploy previous version via Vercel dashboard',
    'Verify rollback successful with quick audit',
  ];
}

function generateMarkdown(packet: FixPacket): string {
  const lines: string[] = [];
  
  lines.push('# JAVARI AUDITOPS - FIX PACKET');
  lines.push(`## Run: ${packet.runId}`);
  lines.push(`## Generated: ${packet.generatedAt}`);
  lines.push(`## Target: ${packet.targetAI.toUpperCase()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('# SUMMARY');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  lines.push(`| BLOCKER | ${packet.summary.BLOCKER} |`);
  lines.push(`| HIGH | ${packet.summary.HIGH} |`);
  lines.push(`| MEDIUM | ${packet.summary.MEDIUM} |`);
  lines.push(`| LOW | ${packet.summary.LOW} |`);
  lines.push(`| **Auto-Fixable** | **${packet.summary.autoFixable}** |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Group by severity
  const severityOrder = ['BLOCKER', 'HIGH', 'MEDIUM', 'LOW'];
  
  for (const severity of severityOrder) {
    const severityIssues = packet.issues.filter(i => i.severity === severity);
    if (severityIssues.length === 0) continue;
    
    lines.push(`# ${severity} ISSUES (${severityIssues.length})`);
    lines.push('');
    
    for (const issue of severityIssues) {
      lines.push(`## ${issue.autoFixable ? '🤖' : '👤'} ${issue.title}`);
      lines.push('');
      lines.push(`**ID:** \`${issue.fingerprint}\``);
      lines.push(`**Category:** ${issue.category}`);
      lines.push(`**Route:** ${issue.route_or_endpoint || 'N/A'}`);
      lines.push(`**Auto-Fixable:** ${issue.autoFixable ? 'Yes ✅' : 'No - Escalate to Claude'}`);
      lines.push('');
      lines.push('### Description');
      lines.push(issue.description);
      lines.push('');
      
      if (issue.recommended_fix) {
        lines.push('### Recommended Fix');
        lines.push('```');
        lines.push(issue.recommended_fix);
        lines.push('```');
        lines.push('');
      }
      
      lines.push('### Acceptance Criteria');
      for (const criterion of issue.acceptance_criteria) {
        lines.push(`- [ ] ${criterion}`);
      }
      lines.push('');
      
      lines.push('### Verification');
      for (const step of issue.verification) {
        lines.push(`1. ${step}`);
      }
      lines.push('');
      
      lines.push('---');
      lines.push('');
    }
  }
  
  lines.push('# END OF FIX PACKET');
  lines.push('');
  lines.push('*Generated by Javari AuditOps*');
  
  return lines.join('\n');
}

async function saveFixPacket(packet: FixPacket, markdown: string): Promise<void> {
  const { error } = await supabase
    .from('audit_fix_packets')
    .insert({
      run_id: packet.runId,
      target_ai: packet.targetAI,
      packet_json: packet,
      packet_markdown: markdown,
      issues_count: packet.issues.length,
      status: 'pending',
    });
  
  if (error) {
    console.error(chalk.yellow('Failed to save fix packet to database:'), error.message);
  }
}
