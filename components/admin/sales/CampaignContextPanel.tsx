'use client';

import { useState, useEffect, useCallback } from 'react';
import { Megaphone, ChevronUp, ChevronDown, RefreshCw, ExternalLink, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getCurrentSession } from '@/lib/auth';
import Link from 'next/link';
import { CAMPAIGN_TYPE_LABELS } from '@/lib/campaigns';
import type { CampaignType } from '@/lib/campaigns';

interface Campaign {
  id: string;
  name: string;
  slug: string;
  campaign_type: string;
  status: string;
  end_date: string | null;
  eligible_bundles: Array<{ bundle_id: string; bundle_name?: string }>;
}

interface Enrollment {
  id: string;
  status: string;
  enrolled_at: string;
  deadline: string | null;
  payout_type: string | null;
  campaign: { id: string; name: string; slug: string; campaign_type: string; status: string } | null;
  progress_summary: { total: number; met: number; percentage: number };
}

interface CampaignContextPanelProps {
  contactEmail: string | null;
}

/** Map /api/campaigns/active response (starts_at, ends_at, campaign_eligible_bundles) into panel Campaign shape */
function normalizeActiveCampaign(raw: {
  id: string;
  name: string;
  slug: string;
  campaign_type: string;
  status: string;
  ends_at?: string | null;
  campaign_eligible_bundles?: Array<{
    bundle_id: string;
    offer_bundles?: { name?: string | null } | null;
  }>;
}): Campaign {
  const bundles = (raw.campaign_eligible_bundles || []).map((b) => ({
    bundle_id: b.bundle_id,
    bundle_name: b.offer_bundles?.name ?? undefined,
  }));
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    campaign_type: raw.campaign_type,
    status: raw.status,
    end_date: raw.ends_at ?? null,
    eligible_bundles: bundles,
  };
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400',
  criteria_met: 'text-blue-400',
  payout_pending: 'text-amber-400',
  refund_issued: 'text-emerald-400',
  credit_issued: 'text-emerald-400',
  rollover_applied: 'text-emerald-400',
  expired: 'text-red-400',
  cancelled: 'text-gray-500',
};

export function CampaignContextPanel({ contactEmail }: CampaignContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getCurrentSession();
      if (!session?.access_token) return;
      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [campaignsRes, enrollmentsRes] = await Promise.all([
        fetch('/api/campaigns/active'),
        contactEmail
          ? fetch(`/api/admin/campaigns/enrollments-by-email?email=${encodeURIComponent(contactEmail)}`, { headers })
          : Promise.resolve(null),
      ]);

      const campaignsData = await campaignsRes.json();
      const rawList = campaignsData.data || [];
      setCampaigns(rawList.map(normalizeActiveCampaign));

      if (enrollmentsRes) {
        const enrollmentsData = await enrollmentsRes.json();
        setEnrollments(enrollmentsData.enrollments || []);
      }
    } catch {
      // Silently fail — panel is supplementary context
    } finally {
      setLoading(false);
    }
  }, [contactEmail]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const enrolledCampaignIds = new Set(enrollments.map((e) => e.campaign?.id).filter(Boolean));
  const hasContent = campaigns.length > 0 || enrollments.length > 0;

  if (!hasContent && !loading) return null;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
        aria-expanded={isExpanded}
        aria-controls="campaign-context-panel-content"
      >
        <h3 className="font-medium text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-amber-500" />
          Active Campaigns
          {campaigns.length > 0 && (
            <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded-full">
              {campaigns.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div id="campaign-context-panel-content" className="mt-4 space-y-3">
          {/* Active campaigns */}
          {campaigns.map((c) => {
            const enrollment = enrollments.find((e) => e.campaign?.id === c.id);
            return (
              <div
                key={c.id}
                className="p-3 rounded-lg border border-gray-700 bg-gray-800/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">{c.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300">
                      {CAMPAIGN_TYPE_LABELS[c.campaign_type as CampaignType] ?? c.campaign_type}
                    </span>
                  </div>
                  <Link
                    href={`/admin/campaigns/${c.id}`}
                    className="text-gray-400 hover:text-white"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {c.end_date && (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    Ends {new Date(c.end_date).toLocaleDateString()}
                  </div>
                )}

                {c.eligible_bundles && c.eligible_bundles.length > 0 && (
                  <div className="text-xs text-gray-500">
                    Eligible: {c.eligible_bundles.map((b) => b.bundle_name || b.bundle_id).join(', ')}
                  </div>
                )}

                {enrollment ? (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-green-400">Enrolled</span>
                    <span className={STATUS_COLORS[enrollment.status] || 'text-gray-400'}>
                      ({enrollment.status.replace(/_/g, ' ')})
                    </span>
                    <span className="ml-auto text-gray-400">
                      {enrollment.progress_summary.percentage}% complete
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <AlertCircle className="w-3 h-3" />
                    Not enrolled — eligible for enrollment
                  </div>
                )}
              </div>
            );
          })}

          {/* Enrollments in non-active campaigns (historical) */}
          {enrollments
            .filter((e) => !enrolledCampaignIds.has(e.campaign?.id) || !campaigns.find((c) => c.id === e.campaign?.id))
            .filter((e) => e.campaign)
            .map((e) => (
              <div
                key={e.id}
                className="p-3 rounded-lg border border-gray-700/50 bg-gray-800/30 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{e.campaign!.name}</span>
                  <span className={`text-xs ${STATUS_COLORS[e.status] || 'text-gray-500'}`}>
                    {e.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {e.progress_summary.met}/{e.progress_summary.total} criteria met
                </div>
              </div>
            ))}

          {campaigns.length === 0 && enrollments.length === 0 && !loading && (
            <p className="text-sm text-gray-500">No active campaigns</p>
          )}
        </div>
      )}
    </div>
  );
}
