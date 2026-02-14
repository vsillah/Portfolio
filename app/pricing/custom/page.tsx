'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PainPointCostCard } from '@/components/pricing/PainPointCostCard';
import { PersonalizedROI } from '@/components/pricing/PersonalizedROI';
import { ValueComparison } from '@/components/pricing/ValueComparison';
import { GuaranteeBadge } from '@/components/pricing/GuaranteeBadge';
import { formatCurrency } from '@/lib/pricing-model';
import type { PricingTier } from '@/lib/pricing-model';

interface CustomPricingData {
  session: { id: string; funnelStage: string };
  client: {
    name: string;
    company: string;
    industry: string;
    companySize: string;
    email: string | null;
  };
  diagnostic: {
    urgencyScore: number;
    opportunityScore: number;
    summary: string | null;
  } | null;
  painPoints: Array<{
    categoryName: string;
    displayName: string;
    annualValue: number;
    formula: string;
    method: string;
    confidence: string;
  }>;
  totalAnnualWaste: number;
  recommendedTier: PricingTier & {
    roi: {
      roiPercent: number;
      roiFormatted: string;
      paybackMonths: number;
      paybackFormatted: string;
      annualSavings: number;
      netFirstYearValue: number;
      investmentRecovery: string | null;
    };
  };
  allTiers: PricingTier[];
}

function CustomPricingContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [data, setData] = useState<CustomPricingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided. Please use the link from your AI audit or proposal.');
      setLoading(false);
      return;
    }

    fetch(`/api/pricing/custom?sessionId=${sessionId}`)
      .then(res => {
        if (!res.ok) throw new Error('Session not found');
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Building your personalized pricing...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Session Not Found</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {error || 'We couldn\'t find pricing data for this session.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/pricing"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              View Standard Pricing
            </Link>
            <a
              href="#contact"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Schedule AI Audit
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { client, diagnostic, painPoints, totalAnnualWaste, recommendedTier, allTiers } = data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <section className="bg-gradient-to-b from-blue-600 to-blue-800 px-4 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-blue-200">Personalized Pricing for</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
            {client.name} — {client.company}
          </h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-blue-100">
            <span>Industry: {client.industry}</span>
            <span>Size: {client.companySize} employees</span>
            {diagnostic && (
              <>
                <span>Opportunity Score: {diagnostic.opportunityScore}/10</span>
                <span>Urgency: {diagnostic.urgencyScore}/10</span>
              </>
            )}
          </div>
          {diagnostic?.summary && (
            <p className="mt-4 max-w-2xl text-blue-100">{diagnostic.summary}</p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-12">
        {/* Pain Points */}
        {painPoints.length > 0 && (
          <PainPointCostCard
            painPoints={painPoints}
            totalAnnualWaste={totalAnnualWaste}
          />
        )}

        {/* Recommended Tier */}
        <div className="rounded-2xl border-2 border-blue-500 bg-white p-6 shadow-md dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
              Recommended for You
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
            {recommendedTier.name}
          </h2>
          <p className="mt-1 text-gray-600 dark:text-gray-400">{recommendedTier.tagline}</p>

          <div className="mt-4 flex items-baseline gap-2">
            {recommendedTier.isCustomPricing && <span className="text-sm text-gray-500">from</span>}
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(recommendedTier.price)}
            </span>
            <span className="text-gray-400 line-through">
              {formatCurrency(recommendedTier.totalRetailValue)}
            </span>
          </div>

          {/* What's included */}
          <div className="mt-6">
            <h4 className="font-semibold text-gray-900 dark:text-white">What&apos;s Included:</h4>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {recommendedTier.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className={item.isDeployed ? 'text-blue-500' : 'text-green-500'}>
                    {item.isDeployed ? '⚡' : '✓'}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {item.title}
                    {item.isDeployed && <span className="ml-1 text-xs text-blue-500">(deployed)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Guarantee */}
          {recommendedTier.guarantee && (
            <div className="mt-6">
              <GuaranteeBadge guarantee={recommendedTier.guarantee} size="lg" />
            </div>
          )}
        </div>

        {/* ROI */}
        {recommendedTier.roi && (
          <PersonalizedROI
            roi={recommendedTier.roi}
            tierPrice={recommendedTier.price}
            tierName={recommendedTier.name}
          />
        )}

        {/* All Tiers */}
        <ValueComparison
          tiers={allTiers}
          recommendedTierId={recommendedTier.id}
        />

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-center text-white">
          <h2 className="text-2xl font-bold">Ready to Move Forward?</h2>
          <p className="mt-2 text-blue-100">
            Let&apos;s discuss how {recommendedTier.name} can transform {client.company}.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="#contact"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow hover:bg-blue-50"
            >
              Schedule a Call
            </a>
            <Link
              href="/pricing"
              className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              View All Pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomPricingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <CustomPricingContent />
    </Suspense>
  );
}
