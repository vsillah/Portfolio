'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Smartphone, Globe, Wrench, Sparkles, 
  ExternalLink, Download, MessageSquare, Star,
  CheckCircle2, TrendingUp, Clock, Info, ShoppingCart
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import PrototypeDemoSelector from './PrototypeDemoSelector'
import PrototypeEnrollment from './PrototypeEnrollment'
import PrototypeFeedback from './PrototypeFeedback'
import ExpandableText from '@/components/ui/ExpandableText'

interface Demo {
  id: string
  title: string
  description: string | null
  demo_type: string
  demo_url: string
  persona_type: string | null
  journey_focus: string | null
  is_primary: boolean
  display_order: number
}

interface StageHistory {
  old_stage: string | null
  new_stage: string
  changed_at: string
}

interface AppPrototype {
  id: string
  title: string
  description: string
  purpose: string
  production_stage: 'Dev' | 'QA' | 'Pilot' | 'Production'
  channel: 'Web' | 'Mobile'
  product_type: 'Utility' | 'Experience'
  thumbnail_url?: string
  download_url?: string
  app_repo_url?: string
  demos?: Demo[]
  stage_history?: StageHistory[]
  feedback_count?: number
  user_enrollment?: string | null
  analytics?: {
    active_users?: number
    pageviews?: number
    downloads?: number
  }
  linked_product?: {
    id: number
    price: number | null
  } | null
}

interface PrototypeCardProps {
  prototype: AppPrototype
  user: any
  isAdmin: boolean
  onEnrollmentSuccess: (prototypeId: string, enrollmentType: string) => void
  index: number
}

export default function PrototypeCard({
  prototype,
  user,
  isAdmin,
  onEnrollmentSuccess,
  index,
}: PrototypeCardProps) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null)
  const [showStageHistory, setShowStageHistory] = useState(false)

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Dev': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'QA': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'Pilot': return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      case 'Production': return 'bg-green-500/20 text-green-400 border-green-500/50'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  const getChannelIcon = () => {
    return prototype.channel === 'Mobile' ? Smartphone : Globe
  }

  const getTypeIcon = () => {
    return prototype.product_type === 'Utility' ? Wrench : Sparkles
  }

  const ChannelIcon = getChannelIcon()
  const TypeIcon = getTypeIcon()

  const primaryDemo = prototype.demos?.find(d => d.is_primary) || prototype.demos?.[0]
  const currentDemoId = selectedDemoId || primaryDemo?.id || ''
  const currentDemo = prototype.demos?.find(d => d.id === currentDemoId) || primaryDemo

  // Get latest stage history entry
  const latestHistory = prototype.stage_history?.[0]
  const stageHistoryText = latestHistory 
    ? latestHistory.old_stage 
      ? `Moved from ${latestHistory.old_stage} on ${new Date(latestHistory.changed_at).toLocaleDateString()}`
      : `In ${latestHistory.new_stage} since ${new Date(latestHistory.changed_at).toLocaleDateString()}`
    : `Currently in ${prototype.production_stage}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800 hover:border-purple-500/50 transition-all duration-300 flex flex-col"
    >
      {/* Thumbnail or Demo */}
      {prototype.demos && prototype.demos.length > 0 ? (
        <div className="relative flex-shrink-0">
          <PrototypeDemoSelector
            demos={prototype.demos}
            prototypeId={prototype.id}
            onDemoChange={setSelectedDemoId}
          />
        </div>
      ) : prototype.thumbnail_url ? (
        <div className="relative h-48 overflow-hidden flex-shrink-0">
          <img
            src={prototype.thumbnail_url}
            alt={prototype.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          
          {/* Stage Badge */}
          <div 
            className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold border ${getStageColor(prototype.production_stage)}`}
            title={stageHistoryText}
          >
            {prototype.production_stage}
          </div>
          
          {/* Purchase Badge */}
          {prototype.linked_product && (
            <Link
              href={`/store/${prototype.linked_product.id}`}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white text-xs font-semibold shadow-lg hover:shadow-purple-500/50 transition-all hover:scale-105"
            >
              <ShoppingCart size={12} />
              {prototype.linked_product.price !== null 
                ? `$${prototype.linked_product.price.toFixed(2)}` 
                : 'Free'}
            </Link>
          )}
        </div>
      ) : (
        <div className="relative h-48 bg-gradient-to-br from-purple-900/20 to-pink-900/20 flex items-center justify-center flex-shrink-0">
          <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold border ${getStageColor(prototype.production_stage)}`}>
            {prototype.production_stage}
          </div>
          <TypeIcon className="text-purple-400" size={48} />
        </div>
      )}

      <div className="p-6 flex flex-col flex-grow">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors mb-1">
              {prototype.title}
            </h3>
            {/* Stage badge with history tooltip */}
            <div className="flex items-center gap-2">
              <div 
                className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStageColor(prototype.production_stage)}`}
                title={stageHistoryText}
              >
                {prototype.production_stage}
              </div>
              {prototype.stage_history && prototype.stage_history.length > 0 && (
                <button
                  onClick={() => setShowStageHistory(!showStageHistory)}
                  className="text-xs text-gray-500 hover:text-gray-400 flex items-center gap-1"
                >
                  <Info size={12} />
                  History
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <ChannelIcon className="text-purple-400" size={20} />
            <TypeIcon className="text-blue-400" size={20} />
          </div>
        </div>

        {/* Stage History Timeline (if expanded) */}
        {showStageHistory && prototype.stage_history && prototype.stage_history.length > 0 && (
          <div className="mb-4 p-3 bg-gray-800/50 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-gray-400 mb-2">Stage History</p>
            {prototype.stage_history.map((history, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-gray-400">
                <Clock size={12} />
                <span>
                  {history.old_stage ? `${history.old_stage} → ${history.new_stage}` : `Started in ${history.new_stage}`}
                </span>
                <span className="text-gray-600">
                  {new Date(history.changed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Expandable Description */}
        <ExpandableText
          text={prototype.description}
          maxHeight={80}
          className="text-gray-400 text-sm"
          expandButtonColor="text-purple-400 hover:text-purple-300"
        />

        {/* Purpose */}
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Purpose</p>
          <p className="text-sm text-gray-300">{prototype.purpose}</p>
        </div>

        {/* Analytics Badge (Production only, public) */}
        {prototype.production_stage === 'Production' && prototype.analytics && (
          <div className="mb-4 flex flex-wrap gap-2">
            {prototype.analytics.active_users !== undefined && (
              <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center gap-2">
                <TrendingUp size={14} className="text-green-400" />
                <span className="text-xs text-green-400">
                  {prototype.analytics.active_users.toLocaleString()} active users
                </span>
              </div>
            )}
            {prototype.analytics.downloads !== undefined && prototype.channel === 'Mobile' && (
              <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center gap-2">
                <Download size={14} className="text-blue-400" />
                <span className="text-xs text-blue-400">
                  {prototype.analytics.downloads.toLocaleString()} downloads
                </span>
              </div>
            )}
            {prototype.analytics.pageviews !== undefined && prototype.channel === 'Web' && (
              <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg flex items-center gap-2">
                <TrendingUp size={14} className="text-purple-400" />
                <span className="text-xs text-purple-400">
                  {prototype.analytics.pageviews.toLocaleString()} pageviews
                </span>
              </div>
            )}
          </div>
        )}

        {/* Metadata Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-2 py-1 text-xs bg-gray-800 text-gray-300 rounded">
            {prototype.channel}
          </span>
          <span className="px-2 py-1 text-xs bg-gray-800 text-gray-300 rounded">
            {prototype.product_type}
          </span>
          {prototype.feedback_count !== undefined && prototype.feedback_count > 0 && (
            <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded flex items-center gap-1">
              <Star size={12} />
              {prototype.feedback_count} reviews
            </span>
          )}
        </div>

        {/* Enrollment Status */}
        {prototype.user_enrollment && (
          <div className="mb-4 p-2 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="text-green-400" size={16} />
            <span className="text-xs text-green-400">
              {prototype.user_enrollment === 'Waitlist' && 'You are on the waitlist'}
              {prototype.user_enrollment === 'Pilot' && 'You are a pilot user'}
              {prototype.user_enrollment === 'Production-Interest' && 'You expressed interest'}
            </span>
          </div>
        )}

        {/* Spacer to push actions to bottom */}
        <div className="flex-grow" />

        {/* Actions */}
        <div className="space-y-2 mt-auto">
          {/* Purchase Button (if linked product exists) */}
          {prototype.linked_product && (
            <Link
              href={`/store/${prototype.linked_product.id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-colors"
            >
              <ShoppingCart size={18} />
              Purchase
              {prototype.linked_product.price !== null && 
                ` - $${prototype.linked_product.price.toFixed(2)}`
              }
            </Link>
          )}
          
          {/* Primary Action Based on Stage */}
          {prototype.production_stage === 'Production' && prototype.channel === 'Mobile' && prototype.download_url ? (
            <a
              href={prototype.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Download size={18} />
              Download App
            </a>
          ) : prototype.production_stage === 'Production' && prototype.channel === 'Web' ? (
            <PrototypeEnrollment
              prototypeId={prototype.id}
              stage={prototype.production_stage}
              user={user}
              currentEnrollment={prototype.user_enrollment || null}
              onSuccess={() => onEnrollmentSuccess(prototype.id, 'Production-Interest')}
            />
          ) : (
            <PrototypeEnrollment
              prototypeId={prototype.id}
              stage={prototype.production_stage}
              user={user}
              currentEnrollment={prototype.user_enrollment || null}
              onSuccess={(type) => onEnrollmentSuccess(prototype.id, type || 'Waitlist')}
            />
          )}

          {/* App Repo Link */}
          {prototype.app_repo_url && (
            <a
              href={prototype.app_repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
            >
              <ExternalLink size={16} />
              View Repository
            </a>
          )}

          {/* Feedback Button - Only for Pilot/Production users */}
          {(prototype.production_stage === 'Production' || 
            (prototype.user_enrollment === 'Pilot')) && user && (
            <button
              onClick={() => setShowFeedback(!showFeedback)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <MessageSquare size={18} />
              {showFeedback ? 'Hide Feedback' : 'View Feedback'}
            </button>
          )}
        </div>

        {/* Feedback Section */}
        {showFeedback && user && (
          <PrototypeFeedback
            prototypeId={prototype.id}
            stage={prototype.production_stage}
            user={user}
            userEnrollment={prototype.user_enrollment || null}
          />
        )}
      </div>
    </motion.div>
  )
}
