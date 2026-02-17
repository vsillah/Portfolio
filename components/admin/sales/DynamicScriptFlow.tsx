'use client';

import { useState } from 'react';
import {
  DynamicStep,
  StepType,
  ResponseType,
  OfferStrategy,
  AIRecommendation,
  STEP_TYPE_LABELS,
  STEP_TYPE_ICONS,
  STEP_TYPE_COLORS,
  RESPONSE_TYPE_LABELS,
  OFFER_STRATEGY_LABELS,
} from '@/lib/sales-scripts';
import { ResponseBar } from './ResponseBar';
import { AIRecommendationPanel } from './AIRecommendationPanel';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CheckCircle,
  Clock,
  Play,
  Sparkles,
  Target,
  RefreshCw,
} from 'lucide-react';

interface DynamicScriptFlowProps {
  steps: DynamicStep[];
  currentStepIndex: number;
  onRecordResponse: (responseType: ResponseType, notes?: string) => void;
  onSelectStrategy: (recommendation: AIRecommendation) => void;
  onCompleteStep: (stepId: string) => void;
  aiRecommendations: AIRecommendation[];
  isLoadingRecommendations: boolean;
  isLoadingNextStep: boolean;
  isCallActive: boolean;
  onStartCall: () => void;
  onRefreshRecommendations: () => void;
}

export function DynamicScriptFlow({
  steps,
  currentStepIndex,
  onRecordResponse,
  onSelectStrategy,
  onCompleteStep,
  aiRecommendations,
  isLoadingRecommendations,
  isLoadingNextStep,
  isCallActive,
  onStartCall,
  onRefreshRecommendations,
}: DynamicScriptFlowProps) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(
    steps[currentStepIndex]?.id || null
  );

  const currentStep = steps[currentStepIndex];

  // Not started state
  if (!isCallActive) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 mx-auto mb-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <Play className="w-10 h-10 text-emerald-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Ready to Start Call</h3>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          Click below to generate your personalized opening based on the client&apos;s diagnostic data.
          The script will adapt to their responses throughout the conversation.
        </p>
        <button
          onClick={onStartCall}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 mx-auto"
        >
          <Play className="w-5 h-5" />
          Start Dynamic Script
        </button>
      </div>
    );
  }

  // Loading first step
  if (isCallActive && steps.length === 0 && isLoadingNextStep) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Generating Your Opening...</h3>
        <p className="text-gray-400">Analyzing diagnostic data to create personalized talking points</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <span>Step {currentStepIndex + 1} of {steps.length}</span>
        {steps.filter(s => s.status === 'completed').length > 0 && (
          <>
            <span className="text-gray-600">|</span>
            <span className="text-green-400">
              {steps.filter(s => s.status === 'completed').length} completed
            </span>
          </>
        )}
      </div>

      {/* Previous steps (collapsed) */}
      {steps.slice(0, currentStepIndex).map((step) => (
        <CollapsedStep
          key={step.id}
          step={step}
          isExpanded={expandedStepId === step.id}
          onToggle={() => setExpandedStepId(expandedStepId === step.id ? null : step.id)}
        />
      ))}

      {/* Current step (expanded) */}
      {currentStep && (
        <ActiveStep
          step={currentStep}
          onCompleteStep={() => onCompleteStep(currentStep.id)}
        />
      )}

      {/* Response tracking */}
      {currentStep && currentStep.status === 'active' && (
        <div className="mt-4">
          <ResponseBar
            onResponse={onRecordResponse}
            disabled={isLoadingRecommendations}
            showNotes={true}
          />
        </div>
      )}

      {/* AI Recommendations */}
      {aiRecommendations.length > 0 && (
        <div className="mt-4">
          <AIRecommendationPanel
            recommendations={aiRecommendations}
            onSelectStrategy={onSelectStrategy}
            isLoading={isLoadingRecommendations}
            onRefresh={onRefreshRecommendations}
          />
        </div>
      )}

      {/* Loading next step indicator */}
      {isLoadingNextStep && (
        <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
            <div>
              <p className="text-sm font-medium text-purple-300">Generating next step...</p>
              <p className="text-xs text-purple-400/70">Adapting script based on client response</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Active step component with full details
function ActiveStep({ 
  step, 
  onCompleteStep 
}: { 
  step: DynamicStep; 
  onCompleteStep: () => void;
}) {
  const colorClass = STEP_TYPE_COLORS[step.type];
  const icon = STEP_TYPE_ICONS[step.type];

  return (
    <div className={`rounded-lg border-2 ${colorClass} overflow-hidden`}>
      {/* Header */}
      <div className="p-4 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-lg">{step.title}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                  {STEP_TYPE_LABELS[step.type]}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">{step.objective}</p>
            </div>
          </div>
          
          {step.triggeredBy && (
            <div className="text-right text-xs">
              <span className="text-gray-500">Triggered by:</span>
              <div className="text-purple-400">
                {RESPONSE_TYPE_LABELS[step.triggeredBy.responseType]} → {OFFER_STRATEGY_LABELS[step.triggeredBy.strategy]}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 bg-gray-900/50">
        {/* Talking Points */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Say This:
          </h4>
          <ul className="space-y-3">
            {step.talkingPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-200 leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Suggested Actions */}
        {step.suggestedActions.length > 0 && (
          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Remember:
            </h4>
            <div className="flex flex-wrap gap-2">
              {step.suggestedActions.map((action, i) => (
                <span 
                  key={i}
                  className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs"
                >
                  {action}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Collapsed step for completed steps
function CollapsedStep({
  step,
  isExpanded,
  onToggle,
}: {
  step: DynamicStep;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const icon = STEP_TYPE_ICONS[step.type];
  const isCompleted = step.status === 'completed';

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/30">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 text-left"
      >
        <div className="flex items-center gap-3">
          {isCompleted ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <Clock className="w-5 h-5 text-gray-500" />
          )}
          <span className="text-lg">{icon}</span>
          <div>
            <span className="font-medium text-gray-300">{step.title}</span>
            {step.response && (
              <span className="ml-2 text-xs text-gray-500">
                → {RESPONSE_TYPE_LABELS[step.response]}
              </span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700/50">
          <ul className="mt-3 space-y-2">
            {step.talkingPoints.slice(0, 3).map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                <ChevronRight className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                {point.length > 100 ? point.substring(0, 100) + '...' : point}
              </li>
            ))}
            {step.talkingPoints.length > 3 && (
              <li className="text-xs text-gray-500">
                +{step.talkingPoints.length - 3} more talking points
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Export helper for step summary
export function StepSummaryBadge({ step }: { step: DynamicStep }) {
  const icon = STEP_TYPE_ICONS[step.type];
  const colorClass = STEP_TYPE_COLORS[step.type];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${colorClass}`}>
      <span>{icon}</span>
      {STEP_TYPE_LABELS[step.type]}
    </span>
  );
}
