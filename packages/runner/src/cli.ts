#!/usr/bin/env node
/**
 * JAVARI AUDITOPS - CLI Entry Point
 * Autonomous QA auditing for CRAudioVizAI ecosystem
 * 
 * Usage:
 *   auditops run --domain craudiovizai.com
 *   auditops run --scope full --env prod
 *   auditops run --scope tier --tier primary
 *   auditops verify --runId <uuid>
 */

import { Command } from 'commander';
import { runAudit } from './commands/run';
import { verifyFixes } from './commands/verify';
import { generateFixPacket } from './reporting/fix-packet';
import { discoverDomains } from './discovery/discover';
import chalk from 'chalk';

const program = new Command();

program
  .name('auditops')
  .description('Javari AuditOps - Autonomous QA Platform')
  .version('1.0.0');

// Run audit command
program
  .command('run')
  .description('Run an audit')
  .option('-e, --env <env>', 'Environment (prod/staging)', 'prod')
  .option('-s, --scope <scope>', 'Scope (full/domain/tier)', 'full')
  .option('-d, --domain <domain>', 'Domain to audit (when scope=domain)')
  .option('-t, --tier <tier>', 'Tier to audit (when scope=tier)')
  .option('--includeModules <modules>', 'Modules to include (CSV)')
  .option('--excludeModules <modules>', 'Modules to exclude (CSV)')
  .option('--maxRuntimeMinutes <minutes>', 'Max runtime', '60')
  .option('--triggeredBy <source>', 'Trigger source', 'manual')
  .option('--crawlBudgetPages <pages>', 'Override crawl budget')
  .option('--crawlBudgetDepth <depth>', 'Override crawl depth')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🛡️  JAVARI AUDITOPS - Starting Audit\n'));
    console.log(chalk.gray(`Timestamp: ${new Date().toISOString()}`));
    console.log(chalk.gray(`Environment: ${options.env}`));
    console.log(chalk.gray(`Scope: ${options.scope}`));
    
    if (options.domain) console.log(chalk.gray(`Domain: ${options.domain}`));
    if (options.tier) console.log(chalk.gray(`Tier: ${options.tier}`));
    
    console.log('');
    
    try {
      await runAudit(options);
    } catch (error) {
      console.error(chalk.red('❌ Audit failed:'), error);
      process.exit(1);
    }
  });

// Verify fixes command
program
  .command('verify')
  .description('Verify fixes for a previous run')
  .requiredOption('--runId <id>', 'Run ID to verify')
  .option('--issueId <id>', 'Specific issue ID to verify')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔍 JAVARI AUDITOPS - Verifying Fixes\n'));
    
    try {
      await verifyFixes(options);
    } catch (error) {
      console.error(chalk.red('❌ Verification failed:'), error);
      process.exit(1);
    }
  });

// Generate fix packet command
program
  .command('fix-packet')
  .description('Generate fix packet for Javari AI / Claude')
  .option('--runId <id>', 'Run ID to generate packet for (default: latest)')
  .option('--severity <level>', 'Minimum severity (BLOCKER/HIGH/MEDIUM/LOW)')
  .option('--target <ai>', 'Target AI (javari/claude/both)', 'javari')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📦 JAVARI AUDITOPS - Generating Fix Packet\n'));
    
    try {
      await generateFixPacket(options);
    } catch (error) {
      console.error(chalk.red('❌ Fix packet generation failed:'), error);
      process.exit(1);
    }
  });

// Discover domains command
program
  .command('discover')
  .description('Discover domains from Vercel/GitHub')
  .option('--source <source>', 'Source (vercel/github/all)', 'all')
  .option('--save', 'Save discovered domains to database')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔎 JAVARI AUDITOPS - Discovering Domains\n'));
    
    try {
      await discoverDomains(options);
    } catch (error) {
      console.error(chalk.red('❌ Discovery failed:'), error);
      process.exit(1);
    }
  });

program.parse();
