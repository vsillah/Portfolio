/**
 * Generate sample value reports for different industries.
 * Calls generateValueReport + saveValueReport directly.
 *
 * Usage: npx tsx scripts/seed-value-reports.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Must load env BEFORE any lib imports that reference process.env at module scope
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: false });

const REPORTS_TO_GENERATE = [
  {
    industry: 'professional_services',
    companySize: '11-50',
    companyName: 'Apex Advisory Group',
    contactName: 'Sarah Mitchell',
    reportType: 'client_facing' as const,
  },
  {
    industry: 'saas',
    companySize: '11-50',
    companyName: 'CloudSync Technologies',
    contactName: 'James Chen',
    reportType: 'client_facing' as const,
  },
  {
    industry: 'ecommerce',
    companySize: '11-50',
    companyName: 'Urban Goods Co.',
    reportType: 'internal_audit' as const,
  },
];

async function main() {
  // Dynamic import so supabase.ts sees the env vars loaded above
  const { generateValueReport, saveValueReport } = require('../lib/value-report-generator');

  let generated = 0;

  for (const spec of REPORTS_TO_GENERATE) {
    console.log(`Generating report for ${spec.industry} / ${spec.companySize} / ${spec.companyName}...`);

    const report = await generateValueReport(
      {
        industry: spec.industry,
        companySize: spec.companySize,
        companyName: spec.companyName,
        contactName: spec.contactName,
      },
      spec.reportType,
    );

    if (!report) {
      console.log(`  Skipped — no pain points or benchmarks for ${spec.industry}`);
      continue;
    }

    const reportId = await saveValueReport(report);
    console.log(`  Saved report ${reportId ?? '(save failed)'} — $${Math.round(report.totalAnnualValue).toLocaleString()}/yr, ${report.valueStatements.length} value statements`);
    generated++;
  }

  console.log(`\nDone: ${generated} reports generated`);
}

main().catch((err: any) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
