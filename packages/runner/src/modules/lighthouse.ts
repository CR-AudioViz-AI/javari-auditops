/**
 * JAVARI AUDITOPS - Lighthouse Module
 * Performance, Accessibility, SEO, and Best Practices auditing
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import crypto from 'crypto';
import type { DomainConfig, AuditIssue, LighthouseResult } from '../types';

// Thresholds for issue severity
const THRESHOLDS = {
  performance: { BLOCKER: 20, HIGH: 40, MEDIUM: 60 },
  accessibility: { BLOCKER: 50, HIGH: 70, MEDIUM: 85 },
  seo: { BLOCKER: 50, HIGH: 70, MEDIUM: 85 },
  bestPractices: { BLOCKER: 50, HIGH: 70, MEDIUM: 85 },
};

export async function runLighthouse(
  domain: DomainConfig,
  runId: string
): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const url = `https://${domain.domain}`;
  
  let chrome: chromeLauncher.LaunchedChrome | null = null;
  
  try {
    // Launch Chrome
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
    });
    
    // Run Lighthouse
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
      formFactor: 'desktop',
      screenEmulation: {
        mobile: false,
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        disabled: false,
      },
    });
    
    if (!result?.lhr) {
      throw new Error('Lighthouse returned no results');
    }
    
    const scores: LighthouseResult = {
      performance: Math.round((result.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((result.lhr.categories.accessibility?.score || 0) * 100),
      seo: Math.round((result.lhr.categories.seo?.score || 0) * 100),
      bestPractices: Math.round((result.lhr.categories['best-practices']?.score || 0) * 100),
    };
    
    // Check performance
    if (scores.performance < THRESHOLDS.performance.MEDIUM) {
      issues.push(createLighthouseIssue({
        runId,
        domainId: domain.id,
        category: 'PERF',
        metric: 'performance',
        score: scores.performance,
        url,
        audits: result.lhr.audits,
      }));
    }
    
    // Check accessibility
    if (scores.accessibility < THRESHOLDS.accessibility.MEDIUM) {
      issues.push(createLighthouseIssue({
        runId,
        domainId: domain.id,
        category: 'A11Y',
        metric: 'accessibility',
        score: scores.accessibility,
        url,
        audits: result.lhr.audits,
      }));
    }
    
    // Check SEO
    if (scores.seo < THRESHOLDS.seo.MEDIUM) {
      issues.push(createLighthouseIssue({
        runId,
        domainId: domain.id,
        category: 'SEO',
        metric: 'seo',
        score: scores.seo,
        url,
        audits: result.lhr.audits,
      }));
    }
    
    // Check specific failing audits
    const failingAudits = Object.entries(result.lhr.audits)
      .filter(([_, audit]: [string, any]) => audit.score !== null && audit.score < 0.5)
      .map(([id, audit]: [string, any]) => ({ id, ...audit }));
    
    // Add specific issues for critical failures
    for (const audit of failingAudits.slice(0, 10)) {
      if (isCriticalAudit(audit.id)) {
        issues.push(createSpecificAuditIssue({
          runId,
          domainId: domain.id,
          audit,
          url,
        }));
      }
    }
    
  } catch (error) {
    issues.push({
      run_id: runId,
      domain_id: domain.id,
      category: 'PERF',
      severity: 'MEDIUM',
      title: 'Lighthouse audit failed',
      description: `Could not run Lighthouse: ${error}`,
      route_or_endpoint: url,
      evidence_urls: [url],
      auto_fixable: false,
      fingerprint: crypto.createHash('sha256').update(`${domain.id}:lighthouse:failed`).digest('hex').substring(0, 16),
      status: 'open',
      occurrence_count: 1,
    });
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }
  
  return issues;
}

function createLighthouseIssue(params: {
  runId: string;
  domainId: string;
  category: 'PERF' | 'A11Y' | 'SEO';
  metric: string;
  score: number;
  url: string;
  audits: any;
}): AuditIssue {
  const thresholds = THRESHOLDS[params.metric as keyof typeof THRESHOLDS];
  let severity: AuditIssue['severity'] = 'LOW';
  
  if (params.score < thresholds.BLOCKER) severity = 'BLOCKER';
  else if (params.score < thresholds.HIGH) severity = 'HIGH';
  else if (params.score < thresholds.MEDIUM) severity = 'MEDIUM';
  
  const categoryNames = {
    PERF: 'Performance',
    A11Y: 'Accessibility',
    SEO: 'SEO',
  };
  
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${params.domainId}:${params.category}:${params.metric}`)
    .digest('hex')
    .substring(0, 16);
  
  return {
    run_id: params.runId,
    domain_id: params.domainId,
    category: params.category,
    severity,
    title: `Low ${categoryNames[params.category]} score: ${params.score}/100`,
    description: `Lighthouse ${params.metric} score is ${params.score}, below the recommended threshold of ${thresholds.MEDIUM}`,
    route_or_endpoint: params.url,
    evidence_urls: [params.url],
    auto_fixable: false,
    recommended_fix: getRecommendedFix(params.metric, params.audits),
    fingerprint,
    status: 'open',
    occurrence_count: 1,
  };
}

function createSpecificAuditIssue(params: {
  runId: string;
  domainId: string;
  audit: any;
  url: string;
}): AuditIssue {
  const category = getAuditCategory(params.audit.id);
  const severity = getAuditSeverity(params.audit.id);
  
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${params.domainId}:${params.audit.id}`)
    .digest('hex')
    .substring(0, 16);
  
  return {
    run_id: params.runId,
    domain_id: params.domainId,
    category,
    severity,
    title: params.audit.title || params.audit.id,
    description: params.audit.description || 'Lighthouse audit failed',
    route_or_endpoint: params.url,
    rule_id: params.audit.id,
    evidence_urls: [params.url],
    auto_fixable: isAutoFixable(params.audit.id),
    recommended_fix: params.audit.description,
    fingerprint,
    status: 'open',
    occurrence_count: 1,
  };
}

function isCriticalAudit(auditId: string): boolean {
  const criticalAudits = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'cumulative-layout-shift',
    'total-blocking-time',
    'image-alt',
    'button-name',
    'link-name',
    'document-title',
    'meta-description',
    'viewport',
  ];
  return criticalAudits.includes(auditId);
}

function getAuditCategory(auditId: string): AuditIssue['category'] {
  if (auditId.includes('a11y') || ['image-alt', 'button-name', 'link-name'].includes(auditId)) {
    return 'A11Y';
  }
  if (['document-title', 'meta-description', 'viewport'].includes(auditId)) {
    return 'SEO';
  }
  return 'PERF';
}

function getAuditSeverity(auditId: string): AuditIssue['severity'] {
  const blockerAudits = ['first-contentful-paint', 'largest-contentful-paint'];
  const highAudits = ['cumulative-layout-shift', 'total-blocking-time', 'image-alt'];
  
  if (blockerAudits.includes(auditId)) return 'BLOCKER';
  if (highAudits.includes(auditId)) return 'HIGH';
  return 'MEDIUM';
}

function isAutoFixable(auditId: string): boolean {
  const autoFixable = [
    'document-title',
    'meta-description',
    'viewport',
    'image-alt',
  ];
  return autoFixable.includes(auditId);
}

function getRecommendedFix(metric: string, audits: any): string {
  switch (metric) {
    case 'performance':
      return 'Optimize images, reduce JavaScript, enable caching, use CDN';
    case 'accessibility':
      return 'Add alt text to images, ensure proper heading hierarchy, add ARIA labels';
    case 'seo':
      return 'Add meta descriptions, ensure proper title tags, add canonical URLs';
    default:
      return 'Review Lighthouse report for specific recommendations';
  }
}
