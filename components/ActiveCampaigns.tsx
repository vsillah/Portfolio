'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Shield, Trophy } from 'lucide-react';
import { CAMPAIGN_TYPE_LABELS } from '@/lib/campaigns';
import type { CampaignType } from '@/lib/campaigns';
import CatalogCard from './CatalogCard';

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

  if (loaded && campaigns.length === 0) return null;
  if (!loaded) return null;

  return (
    <>
      {campaigns.map((campaign, index) => {
        const Icon = CAMPAIGN_ICONS[campaign.campaign_type] || Sparkles;
        const deadline = campaign.enrollment_deadline
          ? `Ends ${new Date(campaign.enrollment_deadline).toLocaleDateString()}`
          : null;

        return (
          <CatalogCard
            key={campaign.id}
            title={campaign.name}
            description={campaign.promo_copy || campaign.description || 'Take the challenge and earn your reward.'}
            href={`/campaigns/${campaign.slug}`}
            imageUrl={campaign.hero_image_url}
            badges={[
              CAMPAIGN_TYPE_LABELS[campaign.campaign_type],
              ...(deadline ? [deadline] : []),
            ]}
            cornerLabel={`${campaign.completion_window_days} day challenge`}
            ctaLabel="View Challenge"
            icon={Icon}
            index={index}
          />
        );
      })}
    </>
  );
}
