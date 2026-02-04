'use client';

import { FunnelStage, FUNNEL_STAGE_LABELS } from '@/lib/sales-scripts';
import { 
  User, 
  Eye, 
  FileText, 
  ShoppingCart, 
  UserCheck, 
  Star,
  ChevronRight,
} from 'lucide-react';

interface FunnelStageSelectorProps {
  currentStage: FunnelStage;
  onChange: (stage: FunnelStage) => void;
  disabled?: boolean;
}

const STAGE_ICONS: Record<FunnelStage, React.ReactNode> = {
  prospect: <User className="w-5 h-5" />,
  interested: <Eye className="w-5 h-5" />,
  informed: <FileText className="w-5 h-5" />,
  converted: <ShoppingCart className="w-5 h-5" />,
  active: <UserCheck className="w-5 h-5" />,
  upgraded: <Star className="w-5 h-5" />,
};

const STAGE_COLORS: Record<FunnelStage, string> = {
  prospect: 'bg-gray-100 text-gray-700 border-gray-300',
  interested: 'bg-blue-100 text-blue-700 border-blue-300',
  informed: 'bg-purple-100 text-purple-700 border-purple-300',
  converted: 'bg-green-100 text-green-700 border-green-300',
  active: 'bg-teal-100 text-teal-700 border-teal-300',
  upgraded: 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

const STAGE_ACTIVE_COLORS: Record<FunnelStage, string> = {
  prospect: 'bg-gray-600 text-white border-gray-600',
  interested: 'bg-blue-600 text-white border-blue-600',
  informed: 'bg-purple-600 text-white border-purple-600',
  converted: 'bg-green-600 text-white border-green-600',
  active: 'bg-teal-600 text-white border-teal-600',
  upgraded: 'bg-yellow-500 text-white border-yellow-500',
};

const STAGES: FunnelStage[] = [
  'prospect',
  'interested',
  'informed',
  'converted',
  'active',
  'upgraded',
];

export function FunnelStageSelector({ currentStage, onChange, disabled }: FunnelStageSelectorProps) {
  const currentIndex = STAGES.indexOf(currentStage);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STAGES.map((stage, index) => {
        const isActive = stage === currentStage;
        const isPast = index < currentIndex;
        
        return (
          <div key={stage} className="flex items-center">
            <button
              onClick={() => onChange(stage)}
              disabled={disabled}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
                ${isActive ? STAGE_ACTIVE_COLORS[stage] : STAGE_COLORS[stage]}
                ${isPast ? 'opacity-60' : ''}
                ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:shadow-md'}
              `}
            >
              {STAGE_ICONS[stage]}
              <span className="whitespace-nowrap font-medium text-sm">
                {FUNNEL_STAGE_LABELS[stage]}
              </span>
            </button>
            
            {index < STAGES.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-400 mx-1 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Compact version for use in cards
interface FunnelStageBadgeProps {
  stage: FunnelStage;
  size?: 'sm' | 'md';
}

export function FunnelStageBadge({ stage, size = 'md' }: FunnelStageBadgeProps) {
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs gap-1' 
    : 'px-3 py-1 text-sm gap-2';

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${STAGE_COLORS[stage]} ${sizeClasses}`}>
      <span className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}>
        {STAGE_ICONS[stage]}
      </span>
      {FUNNEL_STAGE_LABELS[stage]}
    </span>
  );
}
