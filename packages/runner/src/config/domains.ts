/**
 * JAVARI AUDITOPS - Domain Configuration
 * Fetches and filters domains to audit
 */

import { createClient } from '@supabase/supabase-js';
import type { AuditOptions, DomainConfig } from '../types';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function getDomains(options: AuditOptions): Promise<DomainConfig[]> {
  let query = supabase
    .from('audit_domains')
    .select('*')
    .eq('enabled', true);
  
  // Filter by scope
  switch (options.scope) {
    case 'domain':
      if (!options.domain) {
        throw new Error('Domain is required when scope=domain');
      }
      query = query.eq('domain', options.domain);
      break;
    
    case 'tier':
      if (!options.tier) {
        throw new Error('Tier is required when scope=tier');
      }
      query = query.eq('tier', options.tier);
      break;
    
    case 'full':
    default:
      // No additional filter, get all enabled domains
      break;
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch domains: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    // If no domains in DB, use defaults
    return getDefaultDomains(options);
  }
  
  // Apply runtime overrides
  return data.map((domain: DomainConfig) => ({
    ...domain,
    crawl_budget_pages: options.crawlBudgetPages 
      ? parseInt(options.crawlBudgetPages, 10) 
      : domain.crawl_budget_pages,
    crawl_budget_depth: options.crawlBudgetDepth
      ? parseInt(options.crawlBudgetDepth, 10)
      : domain.crawl_budget_depth,
  }));
}

function getDefaultDomains(options: AuditOptions): DomainConfig[] {
  const defaults: DomainConfig[] = [
    {
      id: 'default-1',
      domain: 'craudiovizai.com',
      tier: 'primary',
      enabled: true,
      crawl_budget_pages: 1200,
      crawl_budget_depth: 8,
      max_runtime_minutes: 15,
      requests_per_second: 2,
      concurrency: 4,
      follow_robots_txt: true,
      discovery_source: ['seed'],
    },
    {
      id: 'default-2',
      domain: 'javariverse.com',
      tier: 'primary',
      enabled: true,
      crawl_budget_pages: 1200,
      crawl_budget_depth: 8,
      max_runtime_minutes: 15,
      requests_per_second: 2,
      concurrency: 4,
      follow_robots_txt: true,
      discovery_source: ['seed'],
    },
  ];
  
  // Filter based on options
  if (options.scope === 'domain' && options.domain) {
    return defaults.filter(d => d.domain === options.domain);
  }
  
  if (options.scope === 'tier' && options.tier) {
    return defaults.filter(d => d.tier === options.tier);
  }
  
  return defaults;
}

export async function saveDomain(domain: DomainConfig): Promise<void> {
  const { error } = await supabase
    .from('audit_domains')
    .upsert(domain, { onConflict: 'domain' });
  
  if (error) {
    throw new Error(`Failed to save domain: ${error.message}`);
  }
}

export async function disableDomain(domain: string): Promise<void> {
  const { error } = await supabase
    .from('audit_domains')
    .update({ enabled: false })
    .eq('domain', domain);
  
  if (error) {
    throw new Error(`Failed to disable domain: ${error.message}`);
  }
}

export async function updateLastAudited(domainId: string): Promise<void> {
  const { error } = await supabase
    .from('audit_domains')
    .update({ last_audited_at: new Date().toISOString() })
    .eq('id', domainId);
  
  if (error) {
    console.error(`Failed to update last_audited_at: ${error.message}`);
  }
}
