'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield, Trophy, Sparkles, CheckCircle2, Clock, ArrowRight,
  Target, Package, Loader2,
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import { CAMPAIGN_TYPE_LABELS, CRITERIA_TYPE_LABELS } from '@/lib/campaigns';
import type { CampaignType } from '@/lib/campaigns';

interface CampaignLanding {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  campaign_type: CampaignType;
  hero_image_url: string | null;
  promo_copy: string | null;
  enrollment_deadline: string | null;
  completion_window_days: number;
  payout_type: string;
  payout_amount_type: string;
  campaign_eligible_bundles: Array<{
    bundle_id: string;
    override_min_amount: number | null;
    offer_bundles: {
      id: string; name: string; pricing_tier_slug: string;
      bundle_price: number; tagline: string | null; target_audience_display: string | null;
    } | null;
  }>;
  campaign_criteria_templates: Array<{
    id: string; label_template: string; description_template: string | null;
    criteria_type: string; required: boolean; display_order: number;
  }>;
}

const PAYOUT_DISPLAY: Record<string, string> = {
  refund: 'Full Refund',
  credit: 'Program Credit',
  rollover_upsell: 'Rollover to Premium',
  rollover_continuity: 'Rollover to Continuity',
};

export default function CampaignLandingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [campaign, setCampaign] = useState<CampaignLanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${slug}`)
      .then((res) => {
        if (!res.ok) { setNotFound(true); setLoading(false); return null; }
        return res.json();
      })
      .then((data) => {
        if (data) setCampaign(data.data);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Navigation />
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Navigation />
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="text-3xl font-bold mb-4">Campaign Not Found</h1>
          <p className="text-gray-400 mb-6">This campaign may have ended or does not exist.</p>
          <Link href="/" className="text-amber-400 hover:underline">Back to Home</Link>
        </div>
      </div>
    );
  }

  const Icon = campaign.campaign_type === 'win_money_back' ? Shield
    : campaign.campaign_type === 'free_challenge' ? Trophy : Sparkles;

  const criteria = (campaign.campaign_criteria_templates || []).sort((a, b) => a.display_order - b.display_order);
  const bundles = campaign.campaign_eligible_bundles || [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navigation />

      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/20 via-gray-950 to-gray-950 pointer-events-none" />
        <div className="max-w-4xl mx-auto relative text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-sm mb-6">
              <Icon size={14} />
              {CAMPAIGN_TYPE_LABELS[campaign.campaign_type]}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
              {campaign.name}
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
              {campaign.promo_copy || campaign.description || 'Take the challenge. Do the work. Get rewarded.'}
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
              <span className="flex items-center gap-1"><Clock size={14} /> {campaign.completion_window_days} day window</span>
              <span className="flex items-center gap-1"><Target size={14} /> {criteria.length} criteria</span>
              <span className="flex items-center gap-1"><Package size={14} /> {bundles.length} eligible programs</span>
            </div>
            {campaign.enrollment_deadline && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
                <Clock size={14} />
                Enrollment closes {new Date(campaign.enrollment_deadline).toLocaleDateString()}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Enroll', desc: 'Purchase an eligible program and get automatically enrolled, or speak with our team.' },
              { step: '2', title: 'Do the Work', desc: `Complete ${criteria.length} criteria within ${campaign.completion_window_days} days. We track your progress.` },
              { step: '3', title: 'Get Rewarded', desc: `Meet all criteria and receive your ${PAYOUT_DISPLAY[campaign.payout_type] || 'reward'}.` },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-lg mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Criteria Preview */}
      <section className="py-16 px-4 bg-gray-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">What You Need to Do</h2>
          <p className="text-gray-400 text-center mb-10">
            Criteria are personalized based on your goals and audit results.
          </p>
          <div className="space-y-4">
            {criteria.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl"
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 size={16} className="text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{c.label_template}</span>
                    {c.required && <span className="text-xs text-red-400">Required</span>}
                    <span className="text-xs text-gray-500">{CRITERIA_TYPE_LABELS[c.criteria_type as keyof typeof CRITERIA_TYPE_LABELS]}</span>
                  </div>
                  {c.description_template && <p className="text-sm text-gray-400">{c.description_template}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Eligible Programs */}
      {bundles.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">Eligible Programs</h2>
            <p className="text-gray-400 text-center mb-10">
              Enroll through any of these programs to participate.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bundles.map((eb) => {
                const bundle = eb.offer_bundles;
                if (!bundle) return null;
                return (
                  <motion.div
                    key={eb.bundle_id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                  >
                    <Link href={`/store/${bundle.id}`}>
                      <div className="p-6 bg-gray-900 border border-gray-700 rounded-xl hover:border-amber-500/50 transition-colors group">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold group-hover:text-amber-300 transition-colors">{bundle.name}</h3>
                          <span className="text-amber-400 font-bold">${bundle.bundle_price}</span>
                        </div>
                        {bundle.tagline && <p className="text-sm text-gray-400 mb-3">{bundle.tagline}</p>}
                        {bundle.target_audience_display && (
                          <p className="text-xs text-gray-500">For: {bundle.target_audience_display}</p>
                        )}
                        <div className="flex items-center gap-1 mt-3 text-sm text-amber-400">
                          View Program <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Take the Challenge?</h2>
          <p className="text-gray-400 mb-8">
            Start with our free AI Audit to get personalized criteria, then enroll in an eligible program.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/tools/audit" className="px-6 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-medium transition-colors">
              Start Your Audit
            </Link>
            <Link href="/store" className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl font-medium transition-colors">
              Browse Programs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
