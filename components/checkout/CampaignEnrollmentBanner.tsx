'use client'

import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'
import { CAMPAIGN_TYPE_LABELS } from '@/lib/campaigns'
import type { CampaignType } from '@/lib/campaigns'

export interface CampaignEnrollmentBannerCampaign {
  name: string
  slug: string
  campaign_type: CampaignType
  enrollment_deadline: string | null
}

interface CampaignEnrollmentBannerProps {
  /** When provided, no fetch is made; use from parent (e.g. useCampaignEligibility) to avoid duplicate requests */
  campaign?: CampaignEnrollmentBannerCampaign | null
}

export default function CampaignEnrollmentBanner({ campaign }: CampaignEnrollmentBannerProps) {
  if (!campaign) return null

  const primary = campaign

  return (
    <div className="agent-ops-command-card rounded-xl border p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-radiant-gold/45 bg-radiant-gold/15">
          <Sparkles className="h-4 w-4 text-radiant-gold" />
        </div>
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-bold text-radiant-gold">
            {CAMPAIGN_TYPE_LABELS[primary.campaign_type] || primary.name}
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            Purchase an eligible program and get automatically enrolled in our{' '}
            <strong className="text-amber-400">{primary.name}</strong> campaign.
            Meet the criteria and earn back your investment.
          </p>
          {primary.enrollment_deadline && (
            <p className="mb-2 text-xs text-muted-foreground/80">
              Enrollment deadline: {new Date(primary.enrollment_deadline).toLocaleDateString()}
            </p>
          )}
          <Link
            href={`/campaigns/${primary.slug}`}
            className="inline-flex items-center gap-1 text-xs text-radiant-gold transition-colors hover:text-gold-light"
          >
            Learn more about this campaign
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
