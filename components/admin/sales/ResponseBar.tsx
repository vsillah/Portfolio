'use client';

import { useState } from 'react';
import {
  ResponseType,
  RESPONSE_TYPE_LABELS,
  RESPONSE_TYPE_ICONS,
  RESPONSE_TYPE_COLORS,
} from '@/lib/sales-scripts';
import { MessageSquare, X } from 'lucide-react';

interface ResponseBarProps {
  onResponse: (responseType: ResponseType, notes?: string) => void;
  disabled?: boolean;
  showNotes?: boolean;
}

const RESPONSE_OPTIONS: ResponseType[] = [
  'positive',
  'price_objection',
  'timing_objection',
  'authority_objection',
  'feature_concern',
  'past_failure',
  'diy',
  'competitor',
];

export function ResponseBar({ onResponse, disabled = false, showNotes = true }: ResponseBarProps) {
  const [selectedResponse, setSelectedResponse] = useState<ResponseType | null>(null);
  const [notes, setNotes] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleResponseClick = (responseType: ResponseType) => {
    if (showNotes) {
      setSelectedResponse(responseType);
      setIsExpanded(true);
    } else {
      onResponse(responseType);
    }
  };

  const handleSubmit = () => {
    if (selectedResponse) {
      onResponse(selectedResponse, notes.trim() || undefined);
      setSelectedResponse(null);
      setNotes('');
      setIsExpanded(false);
    }
  };

  const handleCancel = () => {
    setSelectedResponse(null);
    setNotes('');
    setIsExpanded(false);
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-300">How did they respond?</span>
      </div>

      {/* Response buttons */}
      <div className="flex flex-wrap gap-2">
        {RESPONSE_OPTIONS.map((responseType) => (
          <button
            key={responseType}
            onClick={() => handleResponseClick(responseType)}
            disabled={disabled}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
              ${selectedResponse === responseType 
                ? RESPONSE_TYPE_COLORS[responseType] + ' ring-2 ring-offset-2 ring-offset-gray-900'
                : 'bg-gray-700/50 text-gray-300 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="mr-1.5">{RESPONSE_TYPE_ICONS[responseType]}</span>
            {RESPONSE_TYPE_LABELS[responseType]}
          </button>
        ))}
      </div>

      {/* Notes input (expanded state) */}
      {isExpanded && selectedResponse && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">
                Quick note (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did they say?"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-5">
              <button
                onClick={handleCancel}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleSubmit}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${RESPONSE_TYPE_COLORS[selectedResponse]}`}
              >
                Record Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for inline use
export function CompactResponseBar({ 
  onResponse, 
  disabled = false 
}: Omit<ResponseBarProps, 'showNotes'>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RESPONSE_OPTIONS.map((responseType) => (
        <button
          key={responseType}
          onClick={() => onResponse(responseType)}
          disabled={disabled}
          title={RESPONSE_TYPE_LABELS[responseType]}
          className={`
            px-2 py-1 rounded text-xs font-medium border transition-all
            bg-gray-700/50 text-gray-300 border-gray-600 
            hover:bg-gray-700 hover:border-gray-500
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span className="mr-1">{RESPONSE_TYPE_ICONS[responseType]}</span>
          <span className="hidden sm:inline">{RESPONSE_TYPE_LABELS[responseType]}</span>
        </button>
      ))}
    </div>
  );
}
