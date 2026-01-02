/**
 * JAVARI AUDITOPS - Report Generator
 * Generates HTML, JSON, and CSV reports
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import type { AuditRun, AuditIssue } from '../types';

export async function generateReport(
  run: AuditRun,
  issues: AuditIssue[],
  results: Map<string, any>
): Promise<void> {
  const outputDir = path.join(process.cwd(), 'output');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Generate JSON report
  const jsonReport = {
    run,
    issues,
    results: Object.fromEntries(results),
    generatedAt: new Date().toISOString(),
  };
  
  await fs.writeFile(
    path.join(outputDir, 'report.json'),
    JSON.stringify(jsonReport, null, 2)
  );
  console.log(chalk.green('  ✅ JSON report generated'));
  
  // Generate CSV report
  const csv = generateCSV(issues);
  await fs.writeFile(path.join(outputDir, 'issues.csv'), csv);
  console.log(chalk.green('  ✅ CSV report generated'));
  
  // Generate HTML report
  const html = generateHTML(run, issues, results);
  await fs.writeFile(path.join(outputDir, 'report.html'), html);
  console.log(chalk.green('  ✅ HTML report generated'));
}

function generateCSV(issues: AuditIssue[]): string {
  const headers = [
    'fingerprint',
    'severity',
    'category',
    'title',
    'description',
    'route_or_endpoint',
    'auto_fixable',
    'status',
  ];
  
  const rows = issues.map(issue => [
    issue.fingerprint,
    issue.severity,
    issue.category,
    `"${issue.title.replace(/"/g, '""')}"`,
    `"${issue.description.replace(/"/g, '""')}"`,
    issue.route_or_endpoint || '',
    issue.auto_fixable ? 'true' : 'false',
    issue.status,
  ].join(','));
  
  return [headers.join(','), ...rows].join('\n');
}

function generateHTML(
  run: AuditRun,
  issues: AuditIssue[],
  results: Map<string, any>
): string {
  const goNoGoColors = {
    GREEN: '#10b981',
    YELLOW: '#f59e0b',
    RED: '#ef4444',
  };
  
  const goNoGoColor = goNoGoColors[run.go_no_go || 'GREEN'];
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Javari AuditOps Report - ${run.run_id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #60a5fa;
    }
    .meta { color: #94a3b8; margin-bottom: 2rem; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: #1e293b;
      border-radius: 0.5rem;
      padding: 1.5rem;
    }
    .card h3 { color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem; }
    .card .value { font-size: 2rem; font-weight: bold; }
    .go-no-go { color: ${goNoGoColor}; }
    .severity-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .severity-BLOCKER { background: #ef4444; color: white; }
    .severity-HIGH { background: #f59e0b; color: black; }
    .severity-MEDIUM { background: #3b82f6; color: white; }
    .severity-LOW { background: #6b7280; color: white; }
    .issues-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }
    .issues-table th, .issues-table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #334155;
    }
    .issues-table th { 
      background: #1e293b; 
      color: #94a3b8; 
      font-weight: 500;
    }
    .issues-table tr:hover { background: #1e293b; }
    .auto-fix { color: #10b981; }
    .no-auto-fix { color: #ef4444; }
    .category { color: #60a5fa; }
    footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #334155;
      color: #64748b;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛡️ Javari AuditOps Report</h1>
    <p class="meta">
      Run ID: ${run.run_id} | 
      Generated: ${new Date().toISOString()} |
      Duration: ${((run.duration_ms || 0) / 1000).toFixed(1)}s
    </p>
    
    <div class="summary">
      <div class="card">
        <h3>GO/NO-GO STATUS</h3>
        <div class="value go-no-go">${run.go_no_go || 'N/A'}</div>
      </div>
      <div class="card">
        <h3>BLOCKER ISSUES</h3>
        <div class="value" style="color: #ef4444">${run.summary.BLOCKER}</div>
      </div>
      <div class="card">
        <h3>HIGH ISSUES</h3>
        <div class="value" style="color: #f59e0b">${run.summary.HIGH}</div>
      </div>
      <div class="card">
        <h3>TOTAL ISSUES</h3>
        <div class="value">${issues.length}</div>
      </div>
      <div class="card">
        <h3>DOMAINS AUDITED</h3>
        <div class="value">${run.total_domains}</div>
      </div>
      <div class="card">
        <h3>AUTO-FIXABLE</h3>
        <div class="value" style="color: #10b981">${issues.filter(i => i.auto_fixable).length}</div>
      </div>
    </div>
    
    <div class="card">
      <h2 style="margin-bottom: 1rem;">Issues (${issues.length})</h2>
      <table class="issues-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Category</th>
            <th>Title</th>
            <th>Route</th>
            <th>Auto-Fix</th>
          </tr>
        </thead>
        <tbody>
          ${issues.map(issue => `
            <tr>
              <td><span class="severity-badge severity-${issue.severity}">${issue.severity}</span></td>
              <td class="category">${issue.category}</td>
              <td>${escapeHtml(issue.title)}</td>
              <td>${issue.route_or_endpoint ? escapeHtml(issue.route_or_endpoint) : '-'}</td>
              <td class="${issue.auto_fixable ? 'auto-fix' : 'no-auto-fix'}">${issue.auto_fixable ? '✓ Yes' : '✗ No'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <footer>
      <p>Generated by Javari AuditOps | CR AudioViz AI, LLC</p>
      <p>"Build systems that build systems. Never settle."</p>
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
