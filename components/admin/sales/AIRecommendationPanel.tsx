'use client';

import { useState } from 'react';
import {
  AIRecommendation,
  OfferStrategy,
  OFFER_STRATEGY_LABELS,
  OFFER_STRATEGY_DESCRIPTIONS,
  OFFER_ROLE_LABELS,
  OfferRole,
} from '@/lib/sales-scripts';
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Check,
  RefreshCw,
  Lightbulb,
  Target,
  MessageSquare,
} from 'lucide-react';

interface AIRecommendationPanelProps {
  recommendations: AIRecommendation[];
  onSelectStrategy: (recommendation: AIRecommendation) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  disabled?: boolean;
}

// Strategy icons mapping
const STRATEGY_ICONS: Partial<Record<OfferStrategy, string>> = {
  stack_bonuses: '🎁',
  show_decoy: '🎯',
  show_anchor: '⚓',
  payment_plan: '💳',
  limited_time: '⏰',
  case_study: '📊',
  guarantee: '🛡️',
  trial_offer: '🧪',
  stakeholder_call: '👥',
  roi_calculator: '🧮',
  different_product: '🔄',
  schedule_followup: '📅',
  continue_script: '▶️',
};

// Confidence color mapping
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-400 bg-green-500/20';
  if (confidence >= 0.6) return 'text-yellow-400 bg-yellow-500/20';
  return 'text-orange-400 bg-orange-500/20';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  return 'Low';
}

export function AIRecommendationPanel({
  recommendations,
  onSelectStrategy,
  isLoading = false,
  onRefresh,
  disabled = false,
}: AIRecommendationPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
          <div>
            <p className="text-sm font-medium text-purple-300">Analyzing conversation...</p>
            <p className="text-xs text-purple-400/70">Generating personalized recommendations</p>
          </div>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-3 text-gray-400">
          <Sparkles className="w-5 h-5" />
          <p className="text-sm">Record a response to get AI recommendations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-purple-500/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">AI Recommends</span>
          <span className="text-xs text-purple-400/70">({recommendations.length} options)</span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={disabled}
            className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded-lg disabled:opacity-50"
            title="Refresh recommendations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Recommendations */}
      <div className="p-3 space-y-2">
        {recommendations.map((rec, index) => (
          <RecommendationCard
            key={`${rec.strategy}-${index}`}
            recommendation={rec}
            index={index}
            isExpanded={expandedIndex === index}
            onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
            onSelect={() => onSelectStrategy(rec)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

interface RecommendationCardProps {
  recommendation: AIRecommendation;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  disabled?: boolean;
}

function RecommendationCard({
  recommendation,
  index,
  isExpanded,
  onToggle,
  onSelect,
  disabled,
}: RecommendationCardProps) {
  const confidenceColor = getConfidenceColor(recommendation.confidence);
  const confidenceLabel = getConfidenceLabel(recommendation.confidence);
  const icon = STRATEGY_ICONS[recommendation.strategy] || '💡';

  return (
    <div 
      className={`
        border rounded-lg overflow-hidden transition-all
        ${index === 0 
          ? 'border-purple-500/50 bg-purple-500/5' 
          : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
        }
      `}
    >
      {/* Card Header */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white text-sm">
                {OFFER_STRATEGY_LABELS[recommendation.strategy]}
              </span>
              {index === 0 && (
                <span className="px-1.5 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded">
                  Best Match
                </span>
              )}
            </div>
            {recommendation.offerRole && (
              <span className="text-xs text-gray-500">
                {OFFER_ROLE_LABELS[recommendation.offerRole as OfferRole]}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${confidenceColor}`}>
            {Math.round(recommendation.confidence * 100)}% {confidenceLabel}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50 pt-3">
          {/* Why this recommendation */}
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs text-gray-500">Why this works:</span>
              <p className="text-sm text-gray-300">{recommendation.why}</p>
            </div>
          </div>

          {/* Talking point */}
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs text-gray-500">Say this:</span>
              <p className="text-sm text-emerald-300 italic">{recommendation.talkingPoint}</p>
            </div>
          </div>

          {/* Products to present */}
          {recommendation.products.length > 0 && (
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs text-gray-500">Present:</span>
                <div className="space-y-1 mt-1">
                  {recommendation.products.map((product) => (
                    <div key={product.id} className="text-sm">
                      <span className="text-white">{product.name}</span>
                      <span className="text-gray-500 text-xs ml-2">- {product.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Use this strategy button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            disabled={disabled}
            className={`
              w-full mt-2 px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2
              ${index === 0
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            `}
          >
            <Check className="w-4 h-4" />
            Use This Strategy
          </button>
        </div>
      )}
    </div>
  );
}

// Mini version for sidebar
export function MiniRecommendationPanel({
  recommendations,
  onSelectStrategy,
  disabled = false,
}: Omit<AIRecommendationPanelProps, 'isLoading' | 'onRefresh'>) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Sparkles className="w-3 h-3" />
        <span>Quick picks:</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {recommendations.slice(0, 3).map((rec, index) => (
          <button
            key={`${rec.strategy}-${index}`}
            onClick={() => onSelectStrategy(rec)}
            disabled={disabled}
            className={`
              px-2 py-1 rounded text-xs font-medium
              ${index === 0
                ? 'bg-purple-500/30 text-purple-300 hover:bg-purple-500/40'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
              disabled:opacity-50
            `}
            title={rec.why}
          >
            {STRATEGY_ICONS[rec.strategy]} {OFFER_STRATEGY_LABELS[rec.strategy]}
          </button>
        ))}
      </div>
    </div>
  );
}
