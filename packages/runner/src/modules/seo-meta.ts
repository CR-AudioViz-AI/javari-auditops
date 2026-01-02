/**
 * JAVARI AUDITOPS - SEO Meta Module
 * Checks for required SEO meta tags
 */

import { chromium } from 'playwright';
import crypto from 'crypto';
import type { DomainConfig, AuditIssue } from '../types';

export async function checkSEO(
  domain: DomainConfig,
  runId: string
): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const url = `https://${domain.domain}`;
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Check title
    const title = await page.title();
    if (!title || title.length < 10) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'title',
        severity: 'BLOCKER',
        title: 'Missing or short page title',
        description: title 
          ? `Title is too short (${title.length} chars): "${title}"`
          : 'No title tag found',
        url,
        autoFixable: true,
      }));
    } else if (title.length > 60) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'title',
        severity: 'LOW',
        title: 'Page title too long',
        description: `Title is ${title.length} chars (recommended: 50-60)`,
        url,
        autoFixable: true,
      }));
    }
    
    // Check meta description
    const metaDescription = await page.$eval(
      'meta[name="description"]',
      (el) => el.getAttribute('content')
    ).catch(() => null);
    
    if (!metaDescription) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'description',
        severity: 'HIGH',
        title: 'Missing meta description',
        description: 'No meta description found. This is important for SEO and social sharing.',
        url,
        autoFixable: true,
      }));
    } else if (metaDescription.length < 50) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'description',
        severity: 'MEDIUM',
        title: 'Meta description too short',
        description: `Description is ${metaDescription.length} chars (recommended: 150-160)`,
        url,
        autoFixable: true,
      }));
    }
    
    // Check canonical URL
    const canonical = await page.$eval(
      'link[rel="canonical"]',
      (el) => el.getAttribute('href')
    ).catch(() => null);
    
    if (!canonical) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'canonical',
        severity: 'MEDIUM',
        title: 'Missing canonical URL',
        description: 'No canonical link found. This can cause duplicate content issues.',
        url,
        autoFixable: true,
      }));
    }
    
    // Check Open Graph tags
    const ogTags = await page.$$eval('meta[property^="og:"]', (elements) =>
      elements.map((el) => ({
        property: el.getAttribute('property'),
        content: el.getAttribute('content'),
      }))
    );
    
    const requiredOG = ['og:title', 'og:description', 'og:image', 'og:url'];
    const missingOG = requiredOG.filter(
      (tag) => !ogTags.some((t) => t.property === tag && t.content)
    );
    
    if (missingOG.length > 0) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'og',
        severity: 'MEDIUM',
        title: `Missing Open Graph tags: ${missingOG.join(', ')}`,
        description: 'Open Graph tags improve social media sharing appearance.',
        url,
        autoFixable: true,
      }));
    }
    
    // Check Twitter Card tags
    const twitterCard = await page.$eval(
      'meta[name="twitter:card"]',
      (el) => el.getAttribute('content')
    ).catch(() => null);
    
    if (!twitterCard) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'twitter',
        severity: 'LOW',
        title: 'Missing Twitter Card meta tags',
        description: 'Twitter Card tags improve appearance when shared on Twitter/X.',
        url,
        autoFixable: true,
      }));
    }
    
    // Check viewport
    const viewport = await page.$eval(
      'meta[name="viewport"]',
      (el) => el.getAttribute('content')
    ).catch(() => null);
    
    if (!viewport) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'viewport',
        severity: 'BLOCKER',
        title: 'Missing viewport meta tag',
        description: 'Viewport meta tag is required for mobile responsiveness.',
        url,
        autoFixable: true,
      }));
    }
    
    // Check lang attribute
    const lang = await page.$eval('html', (el) => el.getAttribute('lang')).catch(() => null);
    
    if (!lang) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'lang',
        severity: 'LOW',
        title: 'Missing lang attribute on HTML',
        description: 'The lang attribute helps search engines and screen readers.',
        url,
        autoFixable: true,
      }));
    }
    
    // Check for H1
    const h1Count = await page.$$eval('h1', (elements) => elements.length);
    
    if (h1Count === 0) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'h1',
        severity: 'HIGH',
        title: 'Missing H1 heading',
        description: 'Every page should have exactly one H1 heading.',
        url,
        autoFixable: false,
      }));
    } else if (h1Count > 1) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'h1',
        severity: 'MEDIUM',
        title: `Multiple H1 headings found (${h1Count})`,
        description: 'Pages should have exactly one H1 heading for optimal SEO.',
        url,
        autoFixable: false,
      }));
    }
    
    // Check images for alt text
    const imagesWithoutAlt = await page.$$eval(
      'img:not([alt]), img[alt=""]',
      (elements) => elements.length
    );
    
    if (imagesWithoutAlt > 0) {
      issues.push(createSEOIssue({
        runId,
        domainId: domain.id,
        type: 'alt',
        severity: 'MEDIUM',
        title: `${imagesWithoutAlt} images missing alt text`,
        description: 'All images should have descriptive alt text for accessibility and SEO.',
        url,
        autoFixable: true,
      }));
    }
    
  } catch (error) {
    issues.push(createSEOIssue({
      runId,
      domainId: domain.id,
      type: 'error',
      severity: 'MEDIUM',
      title: 'SEO check failed',
      description: `Could not analyze page: ${error}`,
      url,
      autoFixable: false,
    }));
  } finally {
    await browser.close();
  }
  
  return issues;
}

function createSEOIssue(params: {
  runId: string;
  domainId: string;
  type: string;
  severity: AuditIssue['severity'];
  title: string;
  description: string;
  url: string;
  autoFixable: boolean;
}): AuditIssue {
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${params.domainId}:SEO:${params.type}`)
    .digest('hex')
    .substring(0, 16);
  
  return {
    run_id: params.runId,
    domain_id: params.domainId,
    category: 'SEO',
    severity: params.severity,
    title: params.title,
    description: params.description,
    route_or_endpoint: params.url,
    rule_id: `seo-${params.type}`,
    evidence_urls: [params.url],
    auto_fixable: params.autoFixable,
    recommended_fix: getRecommendedFix(params.type),
    fingerprint,
    status: 'open',
    occurrence_count: 1,
  };
}

function getRecommendedFix(type: string): string {
  const fixes: Record<string, string> = {
    title: 'Add a descriptive title tag (50-60 characters) in the <head>',
    description: 'Add <meta name="description" content="Your description here (150-160 chars)">',
    canonical: 'Add <link rel="canonical" href="https://your-domain.com/page">',
    og: 'Add Open Graph meta tags: og:title, og:description, og:image, og:url',
    twitter: 'Add <meta name="twitter:card" content="summary_large_image">',
    viewport: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
    lang: 'Add lang attribute to HTML: <html lang="en">',
    h1: 'Ensure each page has exactly one H1 heading',
    alt: 'Add descriptive alt text to all images',
    error: 'Investigate page loading issues',
  };
  
  return fixes[type] || 'Review SEO best practices';
}
