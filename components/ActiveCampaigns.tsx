'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Clock, Shield, Trophy } from 'lucide-react';
import { CAMPAIGN_TYPE_LABELS } from '@/lib/campaigns';
import type { CampaignType } from '@/lib/campaigns';

interface ActiveCampaignCard {
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
  campaign_eligible_bundles: Array<{
    bundle_id: string;
    offer_bundles: { id: string; name: string; tagline: string | null } | null;
  }>;
  campaign_criteria_templates: Array<{
    id: string;
    label_template: string;
    criteria_type: string;
    required: boolean;
  }>;
}

const CAMPAIGN_ICONS: Record<CampaignType, typeof Trophy> = {
  win_money_back: Shield,
  free_challenge: Trophy,
  bonus_credit: Sparkles,
};

export default function ActiveCampaigns() {
  const [campaigns, setCampaigns] = useState<ActiveCampaignCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/campaigns/active')
      .then((res) => res.ok ? res.json() : { data: [] })
      .then((data) => {
        setCampaigns(data.data || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Collapse to zero height when no campaigns
  if (loaded && campaigns.length === 0) return null;
  if (!loaded) return null;

  return (
    <section id="campaigns" className="py-20 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-sm mb-4">
            <Sparkles size={14} />
            Limited Time Offers
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Special Campaigns
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Take the challenge. Do the work. Get rewarded.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign, index) => {
            const Icon = CAMPAIGN_ICONS[campaign.campaign_type] || Sparkles;
            const criteriaCount = campaign.campaign_criteria_templates?.length || 0;
            const bundleCount = campaign.campaign_eligible_bundles?.length || 0;

            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link href={`/campaigns/${campaign.slug}`}>
                  <div className="group relative h-full bg-gradient-to-br from-gray-900 to-gray-800 border border-amber-500/20 rounded-2xl overflow-hidden hover:border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10">
                    {/* Hero image or gradient */}
                    {campaign.hero_image_url ? (
                      <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${campaign.hero_image_url})` }}>
                        <div className="h-full bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
                      </div>
                    ) : (
                      <div className="h-32 bg-gradient-to-br from-amber-600/20 to-orange-600/20 flex items-center justify-center">
                        <Icon size={48} className="text-amber-400/50" />
                      </div>
                    )}

                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
                          {CAMPAIGN_TYPE_LABELS[campaign.campaign_type]}
                        </span>
                        {campaign.enrollment_deadline && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-red-500/20 text-red-300 rounded-full border border-red-500/30">
                            <Clock size={10} />
                            Ends {new Date(campaign.enrollment_deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                        {campaign.name}
                      </h3>

                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {campaign.promo_copy || campaign.description || 'Take the challenge and earn your reward.'}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                        <span>{criteriaCount} criteria to meet</span>
                        <span>{bundleCount} eligible program{bundleCount !== 1 ? 's' : ''}</span>
                        <span>{campaign.completion_window_days}d window</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-amber-400 font-medium">
                          Learn More
                        </span>
                        <ArrowRight size={16} className="text-amber-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
