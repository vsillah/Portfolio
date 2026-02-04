'use client';

import {
  ConversationResponse,
  ResponseType,
  OfferStrategy,
  RESPONSE_TYPE_LABELS,
  RESPONSE_TYPE_ICONS,
  RESPONSE_TYPE_COLORS,
  OFFER_STRATEGY_LABELS,
} from '@/lib/sales-scripts';
import { 
  Clock, 
  ChevronRight, 
  MessageSquare,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

interface ConversationTimelineProps {
  responses: ConversationResponse[];
  currentStep?: number;
  compact?: boolean;
}

export function ConversationTimeline({
  responses,
  currentStep,
  compact = false,
}: ConversationTimelineProps) {
  if (responses.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No conversation history yet</p>
        <p className="text-xs mt-1">Record responses to build the timeline</p>
      </div>
    );
  }

  if (compact) {
    return <CompactTimeline responses={responses} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Conversation Timeline
        </h4>
        <span className="text-xs text-gray-500">
          {responses.length} interaction{responses.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

        {/* Timeline items */}
        <div className="space-y-4">
          {responses.map((response, index) => (
            <TimelineItem
              key={response.id}
              response={response}
              index={index}
              isLast={index === responses.length - 1}
              isCurrent={currentStep === index + 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TimelineItemProps {
  response: ConversationResponse;
  index: number;
  isLast: boolean;
  isCurrent: boolean;
}

function TimelineItem({ response, index, isLast, isCurrent }: TimelineItemProps) {
  const colorClass = RESPONSE_TYPE_COLORS[response.responseType];
  const icon = RESPONSE_TYPE_ICONS[response.responseType];
  const timestamp = new Date(response.timestamp);
  const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`relative pl-10 ${isCurrent ? 'animate-pulse' : ''}`}>
      {/* Timeline dot */}
      <div 
        className={`
          absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs
          ${colorClass} border-2 border-gray-900
        `}
      >
        {icon}
      </div>

      {/* Content */}
      <div className={`
        p-3 rounded-lg border
        ${isCurrent 
          ? 'bg-purple-500/10 border-purple-500/50' 
          : 'bg-gray-800/50 border-gray-700'
        }
      `}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">#{index + 1}</span>
              <span className={`font-medium text-sm ${
                response.responseType === 'positive' ? 'text-green-400' :
                response.responseType.includes('objection') ? 'text-orange-400' :
                'text-gray-300'
              }`}>
                {RESPONSE_TYPE_LABELS[response.responseType]}
              </span>
            </div>

            {response.notes && (
              <div className="mt-1 flex items-start gap-1.5 text-xs text-gray-400">
                <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>"{response.notes}"</span>
              </div>
            )}

            {response.strategyChosen && (
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span className="text-purple-400">
                  Used: {OFFER_STRATEGY_LABELS[response.strategyChosen]}
                </span>
              </div>
            )}
          </div>

          <span className="text-xs text-gray-500 whitespace-nowrap">{timeStr}</span>
        </div>

        {/* AI recommendations that were shown */}
        {response.aiRecommendations && response.aiRecommendations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700/50">
            <span className="text-xs text-gray-500">AI suggested:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {response.aiRecommendations.map((rec, i) => (
                <span 
                  key={i}
                  className={`
                    px-1.5 py-0.5 rounded text-xs
                    ${rec.strategy === response.strategyChosen
                      ? 'bg-purple-500/30 text-purple-300'
                      : 'bg-gray-700 text-gray-400'
                    }
                  `}
                >
                  {OFFER_STRATEGY_LABELS[rec.strategy]}
                  {rec.strategy === response.strategyChosen && (
                    <CheckCircle className="w-3 h-3 inline ml-1" />
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactTimeline({ responses }: { responses: ConversationResponse[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {responses.map((response, index) => (
        <div
          key={response.id}
          className="flex items-center"
        >
          <div 
            className={`
              px-2 py-1 rounded text-xs font-medium
              ${RESPONSE_TYPE_COLORS[response.responseType]}
            `}
            title={`${RESPONSE_TYPE_LABELS[response.responseType]}${response.notes ? `: ${response.notes}` : ''}`}
          >
            {RESPONSE_TYPE_ICONS[response.responseType]}
            {response.strategyChosen && (
              <ChevronRight className="w-3 h-3 inline mx-0.5 opacity-50" />
            )}
            {response.strategyChosen && (
              <span className="text-purple-300">
                {OFFER_STRATEGY_LABELS[response.strategyChosen].split(' ')[0]}
              </span>
            )}
          </div>
          {index < responses.length - 1 && (
            <ChevronRight className="w-3 h-3 text-gray-600 mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
}

// Summary stats component
export function ConversationStats({ responses }: { responses: ConversationResponse[] }) {
  const positiveCount = responses.filter(r => r.responseType === 'positive').length;
  const objectionCount = responses.filter(r => r.responseType.includes('objection')).length;
  const strategiesUsed = responses.filter(r => r.strategyChosen).length;

  const objectionTypes = responses
    .filter(r => r.responseType.includes('objection'))
    .map(r => r.responseType);
  
  const uniqueObjections = [...new Set(objectionTypes)];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="text-2xl font-bold text-white">{responses.length}</div>
        <div className="text-xs text-gray-400">Total Interactions</div>
      </div>
      <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
        <div className="text-2xl font-bold text-green-400">{positiveCount}</div>
        <div className="text-xs text-green-400/70">Positive Signals</div>
      </div>
      <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
        <div className="text-2xl font-bold text-orange-400">{objectionCount}</div>
        <div className="text-xs text-orange-400/70">Objections ({uniqueObjections.length} types)</div>
      </div>
      <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
        <div className="text-2xl font-bold text-purple-400">{strategiesUsed}</div>
        <div className="text-xs text-purple-400/70">Strategies Used</div>
      </div>
    </div>
  );
}
