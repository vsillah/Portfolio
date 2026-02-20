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
    <div className="bg-gradient-to-r from-amber-600/10 to-orange-600/10 border border-amber-500/30 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-amber-300 mb-1">
            {CAMPAIGN_TYPE_LABELS[primary.campaign_type] || primary.name}
          </h3>
          <p className="text-xs text-platinum-white/70 mb-2">
            Purchase an eligible program and get automatically enrolled in our{' '}
            <strong className="text-amber-400">{primary.name}</strong> campaign.
            Meet the criteria and earn back your investment.
          </p>
          {primary.enrollment_deadline && (
            <p className="text-xs text-gray-500 mb-2">
              Enrollment deadline: {new Date(primary.enrollment_deadline).toLocaleDateString()}
            </p>
          )}
          <Link
            href={`/campaigns/${primary.slug}`}
            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Learn more about this campaign
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
