/**
 * JAVARI AUDITOPS - Security Headers Module
 * Checks for required security headers
 */

import crypto from 'crypto';
import type { DomainConfig, AuditIssue, SecurityHeadersResult } from '../types';

// Required security headers and their recommended values
const REQUIRED_HEADERS = {
  'strict-transport-security': {
    name: 'Strict-Transport-Security (HSTS)',
    severity: 'HIGH' as const,
    recommended: 'max-age=31536000; includeSubDomains; preload',
    autoFixable: true,
    description: 'Enforces HTTPS connections',
  },
  'x-content-type-options': {
    name: 'X-Content-Type-Options',
    severity: 'MEDIUM' as const,
    recommended: 'nosniff',
    autoFixable: true,
    description: 'Prevents MIME type sniffing',
  },
  'x-frame-options': {
    name: 'X-Frame-Options',
    severity: 'MEDIUM' as const,
    recommended: 'DENY',
    autoFixable: true,
    description: 'Prevents clickjacking attacks',
  },
  'x-xss-protection': {
    name: 'X-XSS-Protection',
    severity: 'LOW' as const,
    recommended: '1; mode=block',
    autoFixable: true,
    description: 'Enables XSS filtering',
  },
  'referrer-policy': {
    name: 'Referrer-Policy',
    severity: 'LOW' as const,
    recommended: 'strict-origin-when-cross-origin',
    autoFixable: true,
    description: 'Controls referrer information',
  },
  'content-security-policy': {
    name: 'Content-Security-Policy',
    severity: 'HIGH' as const,
    recommended: "default-src 'self'",
    autoFixable: false,
    description: 'Prevents XSS and data injection',
  },
  'permissions-policy': {
    name: 'Permissions-Policy',
    severity: 'LOW' as const,
    recommended: 'geolocation=(), microphone=(), camera=()',
    autoFixable: true,
    description: 'Controls browser features',
  },
};

export async function checkSecurityHeaders(
  domain: DomainConfig,
  runId: string
): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const url = `https://${domain.domain}`;
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'JavariAuditOpsBot/1.0',
      },
    });
    
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    
    const missing: string[] = [];
    const weak: string[] = [];
    
    // Check each required header
    for (const [headerKey, config] of Object.entries(REQUIRED_HEADERS)) {
      const headerValue = headers[headerKey];
      
      if (!headerValue) {
        // Header is missing
        missing.push(headerKey);
        issues.push(createHeaderIssue({
          runId,
          domainId: domain.id,
          type: 'missing',
          headerKey,
          config,
          url,
        }));
      } else if (isWeakValue(headerKey, headerValue)) {
        // Header has weak value
        weak.push(headerKey);
        issues.push(createHeaderIssue({
          runId,
          domainId: domain.id,
          type: 'weak',
          headerKey,
          config,
          currentValue: headerValue,
          url,
        }));
      }
    }
    
    // Calculate security score
    const totalHeaders = Object.keys(REQUIRED_HEADERS).length;
    const presentHeaders = totalHeaders - missing.length - weak.length;
    const score = Math.round((presentHeaders / totalHeaders) * 100);
    
    // If overall score is low, add summary issue
    if (score < 50) {
      issues.push({
        run_id: runId,
        domain_id: domain.id,
        category: 'SECURITY',
        severity: 'BLOCKER',
        title: `Critical security headers missing (Score: ${score}/100)`,
        description: `${missing.length} security headers are missing and ${weak.length} have weak values`,
        route_or_endpoint: url,
        evidence_urls: [url],
        auto_fixable: true,
        recommended_fix: generateMiddlewareFix(missing, weak),
        fingerprint: crypto.createHash('sha256').update(`${domain.id}:security:overall`).digest('hex').substring(0, 16),
        status: 'open',
        occurrence_count: 1,
      });
    }
    
  } catch (error) {
    issues.push({
      run_id: runId,
      domain_id: domain.id,
      category: 'SECURITY',
      severity: 'MEDIUM',
      title: 'Security headers check failed',
      description: `Could not fetch headers: ${error}`,
      route_or_endpoint: url,
      evidence_urls: [url],
      auto_fixable: false,
      fingerprint: crypto.createHash('sha256').update(`${domain.id}:security:failed`).digest('hex').substring(0, 16),
      status: 'open',
      occurrence_count: 1,
    });
  }
  
  return issues;
}

function createHeaderIssue(params: {
  runId: string;
  domainId: string;
  type: 'missing' | 'weak';
  headerKey: string;
  config: typeof REQUIRED_HEADERS[keyof typeof REQUIRED_HEADERS];
  currentValue?: string;
  url: string;
}): AuditIssue {
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${params.domainId}:security:${params.headerKey}`)
    .digest('hex')
    .substring(0, 16);
  
  const title = params.type === 'missing'
    ? `Missing security header: ${params.config.name}`
    : `Weak security header: ${params.config.name}`;
  
  const description = params.type === 'missing'
    ? `The ${params.config.name} header is not set. ${params.config.description}.`
    : `The ${params.config.name} header has a weak value: "${params.currentValue}". ${params.config.description}.`;
  
  return {
    run_id: params.runId,
    domain_id: params.domainId,
    category: 'SECURITY',
    severity: params.config.severity,
    title,
    description,
    route_or_endpoint: params.url,
    rule_id: `security-header-${params.headerKey}`,
    evidence_urls: [params.url],
    auto_fixable: params.config.autoFixable,
    recommended_fix: `Add to middleware.ts or next.config.js:\n\n"${params.headerKey}": "${params.config.recommended}"`,
    fingerprint,
    status: 'open',
    occurrence_count: 1,
  };
}

function isWeakValue(headerKey: string, value: string): boolean {
  switch (headerKey) {
    case 'strict-transport-security':
      // Weak if max-age is less than 1 year
      const maxAgeMatch = value.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1], 10);
        return maxAge < 31536000;
      }
      return true;
    
    case 'x-frame-options':
      // ALLOWALL is weak
      return value.toLowerCase() === 'allowall';
    
    case 'content-security-policy':
      // Unsafe-inline or unsafe-eval is weak
      return value.includes("'unsafe-inline'") || value.includes("'unsafe-eval'");
    
    default:
      return false;
  }
}

function generateMiddlewareFix(missing: string[], weak: string[]): string {
  const headers = [...missing, ...weak];
  
  const headerEntries = headers.map(key => {
    const config = REQUIRED_HEADERS[key as keyof typeof REQUIRED_HEADERS];
    return `    { key: '${key}', value: '${config.recommended}' },`;
  });
  
  return `// Add to middleware.ts or next.config.js:

export const config = {
  matcher: '/(.*)',
};

export function middleware(request) {
  const response = NextResponse.next();
  
${headerEntries.join('\n')}
  
  return response;
}`;
}
