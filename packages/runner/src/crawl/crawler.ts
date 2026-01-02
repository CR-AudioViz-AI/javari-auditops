/**
 * JAVARI AUDITOPS - Crawler Module
 * Playwright-based site crawler for link integrity and console errors
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import crypto from 'crypto';
import type { DomainConfig, AuditIssue, CrawlResult } from '../types';

let browser: Browser | null = null;

export async function crawlDomain(
  domain: DomainConfig,
  runId: string
): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const visited = new Set<string>();
  const queue: string[] = [`https://${domain.domain}`];
  const baseUrl = `https://${domain.domain}`;
  
  // Initialize browser
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  
  const context = await browser.newContext({
    userAgent: 'JavariAuditOpsBot/1.0 (+https://craudiovizai.com/auditops)',
    viewport: { width: 1920, height: 1080 },
  });
  
  let pagesCrawled = 0;
  const maxPages = domain.crawl_budget_pages;
  const brokenLinks: Map<string, string[]> = new Map();
  const consoleErrors: Map<string, string[]> = new Map();
  
  try {
    while (queue.length > 0 && pagesCrawled < maxPages) {
      const url = queue.shift()!;
      
      if (visited.has(url)) continue;
      visited.add(url);
      
      try {
        const result = await crawlPage(context, url, baseUrl);
        pagesCrawled++;
        
        // Check for broken links (4xx, 5xx)
        if (result.status >= 400) {
          const sources = brokenLinks.get(url) || [];
          brokenLinks.set(url, sources);
        }
        
        // Collect console errors
        if (result.consoleErrors.length > 0) {
          consoleErrors.set(url, result.consoleErrors);
        }
        
        // Add new links to queue
        for (const link of result.links) {
          if (!visited.has(link) && link.startsWith(baseUrl)) {
            queue.push(link);
          }
        }
        
        // Rate limiting
        await sleep(1000 / domain.requests_per_second);
        
      } catch (error) {
        // Page failed to load
        issues.push(createIssue({
          runId,
          domainId: domain.id,
          category: 'LINKS',
          severity: 'HIGH',
          title: `Page failed to load: ${url}`,
          description: `Error: ${error}`,
          route: url,
          autoFixable: false,
        }));
      }
    }
    
    // Generate issues from broken links
    for (const [url, sources] of brokenLinks) {
      issues.push(createIssue({
        runId,
        domainId: domain.id,
        category: 'LINKS',
        severity: 'HIGH',
        title: `Broken link detected`,
        description: `URL ${url} returns error status`,
        route: url,
        evidenceUrls: sources,
        autoFixable: true,
        recommendedFix: 'Update or remove the broken link',
      }));
    }
    
    // Generate issues from console errors
    for (const [url, errors] of consoleErrors) {
      const criticalErrors = errors.filter(e => 
        e.includes('TypeError') || 
        e.includes('ReferenceError') ||
        e.includes('Uncaught')
      );
      
      if (criticalErrors.length > 0) {
        issues.push(createIssue({
          runId,
          domainId: domain.id,
          category: 'UX',
          severity: 'HIGH',
          title: `JavaScript errors on page`,
          description: `${criticalErrors.length} critical JS errors found`,
          route: url,
          evidenceUrls: [url],
          autoFixable: false,
          recommendedFix: `Fix JavaScript errors:\n${criticalErrors.slice(0, 3).join('\n')}`,
        }));
      }
    }
    
  } finally {
    await context.close();
  }
  
  return issues;
}

async function crawlPage(
  context: BrowserContext,
  url: string,
  baseUrl: string
): Promise<CrawlResult> {
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  
  // Collect console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });
  
  const startTime = Date.now();
  
  try {
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    
    const status = response?.status() || 0;
    const loadTime = Date.now() - startTime;
    
    // Extract links
    const links = await page.evaluate((base) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors
        .map(a => {
          const href = a.getAttribute('href');
          if (!href) return null;
          try {
            return new URL(href, base).href;
          } catch {
            return null;
          }
        })
        .filter((href): href is string => href !== null);
    }, baseUrl);
    
    // Extract images
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img[src]'));
      return imgs.map(img => img.getAttribute('src')).filter(Boolean) as string[];
    });
    
    await page.close();
    
    return {
      url,
      status,
      redirects: [],
      links: [...new Set(links)],
      images,
      consoleErrors,
      loadTime,
    };
    
  } catch (error) {
    await page.close();
    throw error;
  }
}

function createIssue(params: {
  runId: string;
  domainId: string;
  category: AuditIssue['category'];
  severity: AuditIssue['severity'];
  title: string;
  description: string;
  route?: string;
  evidenceUrls?: string[];
  autoFixable?: boolean;
  recommendedFix?: string;
}): AuditIssue {
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${params.domainId}:${params.category}:${params.title}:${params.route || ''}`)
    .digest('hex')
    .substring(0, 16);
  
  return {
    run_id: params.runId,
    domain_id: params.domainId,
    category: params.category,
    severity: params.severity,
    title: params.title,
    description: params.description,
    route_or_endpoint: params.route,
    evidence_urls: params.evidenceUrls || [],
    auto_fixable: params.autoFixable || false,
    recommended_fix: params.recommendedFix,
    fingerprint,
    status: 'open',
    occurrence_count: 1,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
