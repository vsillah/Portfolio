import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import {
  Clock,
  ShieldCheck,
  TrendingUp,
  Target,
  Users,
  ArrowLeft,
  BookOpen,
  Calculator,
  Database,
  Search,
} from 'lucide-react';

export const metadata = {
  title: 'Pricing Methodology | Amadutown',
  description:
    'How we calculate retail values, ROI estimates, and price anchors. Full transparency into our pricing methodology, data sources, and calculation formulas.',
};

// ============================================================================
// Static content
// ============================================================================

const CALCULATION_METHODS = [
  {
    name: 'Time Saved',
    icon: Clock,
    formula: 'hours_per_week × hourly_rate × weeks_per_year',
    example: '10 hrs/week × $45/hr × 52 weeks = $23,400/year',
    bestFor: 'Manual processes, data entry, repetitive tasks',
    description:
      'Measures the dollar value of time freed up by automating or eliminating manual work. Uses industry-standard hourly rates from BLS and salary survey data.',
  },
  {
    name: 'Error Reduction',
    icon: ShieldCheck,
    formula: 'error_rate × cost_per_error × annual_volume',
    example: '5% error rate × $250/error × 2,000 transactions = $25,000/year',
    bestFor: 'Quality issues, compliance, data accuracy',
    description:
      'Quantifies the cost of errors that AI can prevent. Error rates and costs come from industry benchmarks and client-reported data.',
  },
  {
    name: 'Revenue Acceleration',
    icon: TrendingUp,
    formula: 'days_faster × daily_revenue_impact',
    example: '30 days faster × $820/day revenue = $24,600/year',
    bestFor: 'Speed-to-market, faster sales cycles, quicker delivery',
    description:
      'Captures the value of getting to revenue sooner. Daily revenue impact is derived from annual revenue benchmarks divided by business days.',
  },
  {
    name: 'Opportunity Cost',
    icon: Target,
    formula: 'missed_opportunities × avg_deal_value × close_rate',
    example: '75 missed leads × $8,000 deal × 20% close = $120,000/year',
    bestFor: 'Lead follow-up, sales pipeline, customer acquisition',
    description:
      'Estimates revenue lost from leads and opportunities that fall through the cracks. Deal sizes and close rates come from industry benchmarks.',
  },
  {
    name: 'Replacement Cost',
    icon: Users,
    formula: 'fte_count × avg_salary × benefits_multiplier',
    example: '0.5 FTE × $65,000 salary × 1.3 benefits = $42,250/year',
    bestFor: 'Headcount reduction, automation of full roles',
    description:
      'Measures the equivalent labor cost that AI replaces or redirects. Salary data comes from BLS, Glassdoor, and industry compensation surveys.',
  },
];

const DATA_SOURCES = [
  {
    name: 'Bureau of Labor Statistics (BLS)',
    url: 'https://www.bls.gov',
    dataTypes: 'Hourly wages, employee costs, industry employment data',
    year: '2024-2025',
  },
  {
    name: 'Glassdoor Salary Data',
    url: 'https://www.glassdoor.com/Salaries',
    dataTypes: 'Role-specific salaries, compensation benchmarks',
    year: '2024-2025',
  },
  {
    name: 'HubSpot Sales Benchmark Report',
    url: 'https://www.hubspot.com',
    dataTypes: 'Deal sizes, close rates, sales cycle length',
    year: '2024',
  },
  {
    name: 'McKinsey & Company',
    url: 'https://www.mckinsey.com',
    dataTypes: 'AI adoption rates, automation potential by industry',
    year: '2023-2024',
  },
  {
    name: 'Gartner IT Spending Forecasts',
    url: 'https://www.gartner.com',
    dataTypes: 'IT budgets, tool spending, digital transformation investment',
    year: '2024-2025',
  },
];

// ============================================================================
// Page Component
// ============================================================================

export default function PricingMethodologyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-body">
      <Navigation />

      {/* Header */}
      <section className="bg-imperial-navy pt-32 pb-16 lg:pt-40 lg:pb-20">
        <div className="relative z-10 mx-auto max-w-4xl px-6">
          <Breadcrumbs
            items={[
              { label: 'Pricing', href: '/pricing' },
              { label: 'Methodology' },
            ]}
          />

          <h1 className="mt-8 font-premium text-4xl sm:text-5xl text-platinum-white leading-tight tracking-tight">
            Pricing Methodology
          </h1>
          <p className="mt-4 text-lg text-platinum-white/70 max-w-2xl">
            Full transparency into how we calculate retail values, ROI estimates, and price
            anchors. Every number on our pricing page is formula-derived from verifiable data sources.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 dark:from-gray-950 to-transparent pointer-events-none" />
      </section>

      <main className="mx-auto max-w-4xl px-6 py-16 space-y-20">
        {/* Section 1: Overview */}
        <section>
          <SectionHeader icon={Calculator} title="How Retail Values Are Derived" />
          <div className="mt-6 prose prose-gray dark:prose-invert max-w-none text-[15px]">
            <p>
              Each item in our pricing tiers has a <strong>retail value</strong> that represents
              what it would cost to purchase that deliverable independently at market rates.
              Instead of picking round numbers, we compute each value using a simple formula:
            </p>
            <div className="my-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 not-prose">
              <p className="text-center font-mono text-sm text-gray-700 dark:text-gray-300">
                Retail Value = Base Hours × Hourly Rate × Category Multiplier
              </p>
            </div>
            <p>Where:</p>
            <ul>
              <li>
                <strong>Base Hours</strong> — estimated effort to deliver the item as a standalone
                engagement (e.g., 128 hours for an AI chatbot, 42 hours for a strategy workshop).
              </li>
              <li>
                <strong>Hourly Rate</strong> — sourced from industry benchmarks (BLS, Glassdoor)
                for the client&apos;s industry and company size. Falls back to segment-level defaults
                when specific data isn&apos;t available.
              </li>
              <li>
                <strong>Category Multiplier</strong> — reflects the market premium for different
                types of work:
              </li>
            </ul>
            <div className="my-4 not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { label: 'Consulting', mult: '2.0×', desc: 'Strategy & advisory' },
                { label: 'Technology', mult: '2.8×', desc: 'AI/dev engineering' },
                { label: 'Content', mult: '1.5×', desc: 'Creation & design' },
                { label: 'Support', mult: '1.2×', desc: 'Maintenance & help' },
              ].map((cat) => (
                <div
                  key={cat.label}
                  className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                >
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{cat.mult}</p>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {cat.label}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{cat.desc}</p>
                </div>
              ))}
            </div>
            <p>
              This produces non-round numbers (e.g., $15,053 instead of $15,000) because the
              underlying benchmarks and effort estimates are precise — not rounded for convenience.
            </p>
          </div>
        </section>

        {/* Section 2: Segment Adaptation */}
        <section>
          <SectionHeader icon={Search} title="How Values Adapt to Your Context" />
          <div className="mt-6 prose prose-gray dark:prose-invert max-w-none text-[15px]">
            <p>
              Retail values are not static. They shift based on three factors:
            </p>
            <ol>
              <li>
                <strong>Segment</strong> — Small Business, Mid-Market, or Nonprofit. Each maps to
                different default hourly rates and company sizes.
              </li>
              <li>
                <strong>Industry</strong> — When you use the ROI Calculator and select your
                industry, we look up industry-specific benchmarks. Technology firms see higher
                rates than retail, for example.
              </li>
              <li>
                <strong>Company Size</strong> — Larger companies have higher wage benchmarks,
                which increases the calculated retail value of each deliverable.
              </li>
            </ol>
            <p>
              The benchmark resolution follows a four-tier fallback: exact industry + size match
              → same industry any size → default industry + size → default industry any size.
              This ensures we always have a reasonable value even when specific data isn&apos;t
              available.
            </p>
          </div>
        </section>

        {/* Section 3: Calculation Methods */}
        <section>
          <SectionHeader icon={BookOpen} title="ROI Calculation Methods" />
          <p className="mt-4 text-[15px] text-gray-600 dark:text-gray-400">
            We use five calculation methods to estimate the monetary impact of business pain
            points. Each method has a formula, data sources, and confidence level.
          </p>

          <div className="mt-8 space-y-6">
            {CALCULATION_METHODS.map((method) => (
              <div
                key={method.name}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-imperial-navy/10 dark:bg-radiant-gold/10">
                    <method.icon className="h-4 w-4 text-imperial-navy dark:text-radiant-gold" />
                  </div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                    {method.name}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {method.description}
                </p>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50 space-y-1.5">
                  <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
                    {method.formula}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Example:</span> {method.example}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Best for: {method.bestFor}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Worked Example */}
        <section>
          <SectionHeader icon={Calculator} title="Worked Example" />
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-4">
              AI Customer Support Chatbot — SMB Segment
            </h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-baseline justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                <span>Base Hours (design, build, configure, test, deploy)</span>
                <span className="font-mono font-medium text-gray-900 dark:text-white">128 hrs</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                <span>Hourly Rate (SMB default, BLS avg_hourly_wage)</span>
                <span className="font-mono font-medium text-gray-900 dark:text-white">$42/hr</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                <span>Category Multiplier (Technology)</span>
                <span className="font-mono font-medium text-gray-900 dark:text-white">2.8×</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-medium text-gray-900 dark:text-white">Retail Value</span>
                <span className="font-mono text-lg font-bold text-radiant-gold">
                  128 × $42 × 2.8 = $15,053
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              For a midmarket company (avg hourly rate $58), the same chatbot would be valued at
              128 × $58 × 2.8 = <span className="font-mono">$20,787</span>. For a nonprofit
              (avg hourly rate $30), it would be 128 × $30 × 2.8 ={' '}
              <span className="font-mono">$10,752</span>.
            </p>
          </div>
        </section>

        {/* Section 5: Data Sources */}
        <section>
          <SectionHeader icon={Database} title="Data Sources" />
          <p className="mt-4 text-[15px] text-gray-600 dark:text-gray-400 mb-6">
            All benchmark values are sourced from publicly available, reputable data:
          </p>
          <div className="space-y-3">
            {DATA_SOURCES.map((source) => (
              <div
                key={source.name}
                className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {source.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {source.dataTypes}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {source.year}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 6: Price Anchoring */}
        <section>
          <SectionHeader icon={BookOpen} title="Price Anchoring & Savings" />
          <div className="mt-6 prose prose-gray dark:prose-invert max-w-none text-[15px]">
            <p>
              The <strong>strikethrough price</strong> on each tier card represents the total
              retail value — the sum of each item&apos;s individually-calculated retail value.
              The <strong>bundle price</strong> is our actual price for the package.
            </p>
            <p>
              The <strong>savings percentage</strong> is calculated as:
            </p>
            <div className="my-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 not-prose">
              <p className="text-center font-mono text-sm text-gray-700 dark:text-gray-300">
                Savings% = ((Total Retail Value - Bundle Price) / Total Retail Value) × 100
              </p>
            </div>
            <p>
              This is a standard price anchoring technique. The retail value represents what each
              item would cost if purchased separately at market rates. By bundling, clients get
              significant savings while we benefit from operational efficiency.
            </p>
          </div>
        </section>

        {/* Section 7: Disclaimer */}
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-900/10">
          <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-amber-800 dark:text-amber-400 mb-3">
            Important Disclaimer
          </h3>
          <div className="text-sm text-amber-700 dark:text-amber-300/80 space-y-2">
            <p>
              All values shown on our pricing page are <strong>estimates</strong> based on
              industry benchmarks and general assumptions. They are not guarantees of savings or
              ROI for any specific business.
            </p>
            <p>
              Actual outcomes depend on your specific situation, implementation quality, team
              adoption, and market conditions. For personalized projections based on your
              business data, schedule a free AI audit.
            </p>
            <p>
              Benchmark data is updated periodically but may not reflect the most current market
              conditions. Last updated: February 2026.
            </p>
          </div>
        </section>

        {/* Back link */}
        <div className="flex justify-center pt-4">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-sm font-heading font-bold uppercase tracking-wide text-imperial-navy hover:text-radiant-gold dark:text-radiant-gold dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pricing
          </Link>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Section Header Component
// ============================================================================

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-imperial-navy/10 dark:bg-radiant-gold/10">
        <Icon className="h-5 w-5 text-imperial-navy dark:text-radiant-gold" />
      </div>
      <h2 className="font-premium text-2xl text-gray-900 dark:text-white">{title}</h2>
    </div>
  );
}
