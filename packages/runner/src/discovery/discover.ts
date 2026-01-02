/**
 * JAVARI AUDITOPS - Domain Discovery
 * Auto-discovers domains from Vercel and GitHub
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import type { DomainConfig } from '../types';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface DiscoveryOptions {
  source?: 'vercel' | 'github' | 'all';
  save?: boolean;
}

export async function discoverDomains(options: DiscoveryOptions): Promise<void> {
  const source = options.source || 'all';
  const discovered: DomainConfig[] = [];
  
  console.log(chalk.cyan(`Discovering domains from: ${source}`));
  
  if (source === 'vercel' || source === 'all') {
    const vercelDomains = await discoverFromVercel();
    discovered.push(...vercelDomains);
    console.log(chalk.green(`  Found ${vercelDomains.length} domains from Vercel`));
  }
  
  if (source === 'github' || source === 'all') {
    const githubDomains = await discoverFromGitHub();
    discovered.push(...githubDomains);
    console.log(chalk.green(`  Found ${githubDomains.length} domains from GitHub`));
  }
  
  // Deduplicate
  const uniqueDomains = deduplicateDomains(discovered);
  console.log(chalk.cyan(`\nTotal unique domains: ${uniqueDomains.length}`));
  
  // Print discovered domains
  console.log(chalk.gray('\nDiscovered domains:'));
  for (const domain of uniqueDomains) {
    console.log(chalk.gray(`  • ${domain.domain} (${domain.tier})`));
  }
  
  // Save if requested
  if (options.save && uniqueDomains.length > 0) {
    console.log(chalk.cyan('\nSaving to database...'));
    await saveDomains(uniqueDomains);
    console.log(chalk.green('✅ Domains saved'));
  }
}

async function discoverFromVercel(): Promise<DomainConfig[]> {
  const vercelToken = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  
  if (!vercelToken) {
    console.log(chalk.yellow('  ⚠️  VERCEL_TOKEN not set, skipping Vercel discovery'));
    return [];
  }
  
  const domains: DomainConfig[] = [];
  
  try {
    // Fetch all projects
    const projectsRes = await fetch(
      `https://api.vercel.com/v9/projects?teamId=${teamId}&limit=200`,
      {
        headers: { Authorization: `Bearer ${vercelToken}` },
      }
    );
    
    const projectsData = await projectsRes.json();
    const projects = projectsData.projects || [];
    
    for (const project of projects) {
      // Get project domains
      const domainsRes = await fetch(
        `https://api.vercel.com/v9/projects/${project.id}/domains?teamId=${teamId}`,
        {
          headers: { Authorization: `Bearer ${vercelToken}` },
        }
      );
      
      const domainsData = await domainsRes.json();
      const projectDomains = domainsData.domains || [];
      
      for (const d of projectDomains) {
        if (!d.name.includes('.vercel.app')) {
          domains.push(createDomainConfig(d.name, 'vercel'));
        }
      }
      
      // Also add the production URL
      if (project.targets?.production?.url) {
        const prodUrl = project.targets.production.url;
        if (!prodUrl.includes('.vercel.app')) {
          domains.push(createDomainConfig(prodUrl, 'vercel'));
        }
      }
    }
    
  } catch (error) {
    console.error(chalk.red('  Vercel discovery error:'), error);
  }
  
  return domains;
}

async function discoverFromGitHub(): Promise<DomainConfig[]> {
  const githubToken = process.env.GH_PAT || process.env.GITHUB_TOKEN;
  const org = 'CR-AudioViz-AI';
  
  if (!githubToken) {
    console.log(chalk.yellow('  ⚠️  GITHUB_TOKEN not set, skipping GitHub discovery'));
    return [];
  }
  
  const domains: DomainConfig[] = [];
  
  try {
    // Fetch all repos
    const reposRes = await fetch(
      `https://api.github.com/orgs/${org}/repos?per_page=200`,
      {
        headers: { 
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    
    const repos = await reposRes.json();
    
    for (const repo of repos) {
      // Check for homepage URL
      if (repo.homepage && isValidDomain(repo.homepage)) {
        const domain = extractDomain(repo.homepage);
        if (domain) {
          domains.push(createDomainConfig(domain, 'github'));
        }
      }
      
      // Check for vercel.json or deployment configs
      // (This would require additional API calls to check file contents)
    }
    
  } catch (error) {
    console.error(chalk.red('  GitHub discovery error:'), error);
  }
  
  return domains;
}

function createDomainConfig(domain: string, source: string): DomainConfig {
  // Classify domain by tier
  const tier = classifyDomain(domain);
  
  // Set crawl budget based on tier
  const budgets = {
    primary: { pages: 1200, depth: 8 },
    product: { pages: 800, depth: 6 },
    subdomain: { pages: 600, depth: 6 },
    apps: { pages: 500, depth: 6 },
    collector: { pages: 400, depth: 4 },
  };
  
  const budget = budgets[tier];
  
  return {
    id: '', // Will be generated by Supabase
    domain: domain.toLowerCase(),
    tier,
    enabled: true,
    crawl_budget_pages: budget.pages,
    crawl_budget_depth: budget.depth,
    max_runtime_minutes: tier === 'primary' ? 15 : 8,
    requests_per_second: 2,
    concurrency: 4,
    follow_robots_txt: true,
    discovery_source: [source],
  };
}

function classifyDomain(domain: string): DomainConfig['tier'] {
  const d = domain.toLowerCase();
  
  // Primary domains
  if (d === 'craudiovizai.com' || d === 'www.craudiovizai.com' ||
      d === 'javariverse.com' || d === 'www.javariverse.com') {
    return 'primary';
  }
  
  // Product domains (have their own TLD)
  if (!d.includes('.craudiovizai.com') && 
      (d.includes('javari') || d.includes('crav'))) {
    return 'product';
  }
  
  // Subdomains
  if (d.endsWith('.craudiovizai.com')) {
    return 'subdomain';
  }
  
  // Collector apps
  if (d.includes('collector') || d.includes('vault') || 
      d.includes('museum') || d.includes('archive')) {
    return 'collector';
  }
  
  // Default to apps
  return 'apps';
}

function isValidDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && 
           !parsed.hostname.includes('github.com') &&
           !parsed.hostname.includes('vercel.app');
  } catch {
    return false;
  }
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

function deduplicateDomains(domains: DomainConfig[]): DomainConfig[] {
  const seen = new Map<string, DomainConfig>();
  
  for (const domain of domains) {
    const key = domain.domain.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, domain);
    } else {
      // Merge discovery sources
      const existing = seen.get(key)!;
      existing.discovery_source = [
        ...new Set([...existing.discovery_source, ...domain.discovery_source])
      ];
    }
  }
  
  return Array.from(seen.values());
}

async function saveDomains(domains: DomainConfig[]): Promise<void> {
  for (const domain of domains) {
    const { error } = await supabase
      .from('audit_domains')
      .upsert(
        {
          domain: domain.domain,
          tier: domain.tier,
          enabled: domain.enabled,
          crawl_budget_pages: domain.crawl_budget_pages,
          crawl_budget_depth: domain.crawl_budget_depth,
          max_runtime_minutes: domain.max_runtime_minutes,
          requests_per_second: domain.requests_per_second,
          concurrency: domain.concurrency,
          follow_robots_txt: domain.follow_robots_txt,
          discovery_source: domain.discovery_source,
        },
        { onConflict: 'domain' }
      );
    
    if (error) {
      console.error(chalk.red(`  Failed to save ${domain.domain}:`), error.message);
    }
  }
}
