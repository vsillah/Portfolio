'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { CampaignType } from '@/lib/campaigns';

export interface ActiveCampaignSummary {
  id: string;
  name: string;
  slug: string;
  campaign_type: CampaignType;
  enrollment_deadline: string | null;
  eligible_bundle_ids: string[];
}

let cachedCampaigns: ActiveCampaignSummary[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

export function useCampaignEligibility() {
  const [campaigns, setCampaigns] = useState<ActiveCampaignSummary[]>(cachedCampaigns || []);
  const [loaded, setLoaded] = useState(!!cachedCampaigns);

  useEffect(() => {
    if (cachedCampaigns && Date.now() - cacheTimestamp < CACHE_TTL) {
      setCampaigns(cachedCampaigns);
      setLoaded(true);
      return;
    }

    fetch('/api/campaigns/active')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        const raw = json.data || [];
        const mapped: ActiveCampaignSummary[] = raw.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          slug: c.slug as string,
          campaign_type: c.campaign_type as CampaignType,
          enrollment_deadline: c.enrollment_deadline as string | null,
          eligible_bundle_ids: (
            (c.campaign_eligible_bundles as Array<{ bundle_id: string }>) || []
          ).map((b) => b.bundle_id),
        }));
        cachedCampaigns = mapped;
        cacheTimestamp = Date.now();
        setCampaigns(mapped);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const bundleToCampaign = useMemo(() => {
    const map = new Map<string, ActiveCampaignSummary>();
    for (const c of campaigns) {
      for (const bid of c.eligible_bundle_ids) {
        if (!map.has(bid)) map.set(bid, c);
      }
    }
    return map;
  }, [campaigns]);

  const getCampaignForBundle = useCallback(
    (bundleId: string): ActiveCampaignSummary | null => {
      return bundleToCampaign.get(bundleId) || null;
    },
    [bundleToCampaign],
  );

  return { campaigns, loaded, getCampaignForBundle };
}
