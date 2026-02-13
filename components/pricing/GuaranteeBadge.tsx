'use client';

import type { GuaranteeDef } from '@/lib/pricing-model';

interface GuaranteeBadgeProps {
  guarantee: GuaranteeDef;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GuaranteeBadge({ guarantee, size = 'md', className = '' }: GuaranteeBadgeProps) {
  const durationLabel = guarantee.durationDays <= 30
    ? '30-Day'
    : guarantee.durationDays <= 90
      ? '90-Day'
      : guarantee.durationDays <= 365
        ? '1-Year'
        : `${Math.round(guarantee.durationDays / 30)}-Month`;

  const typeLabel = guarantee.type === 'unconditional' ? 'Money-Back' : 'Outcome-Based';

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 ${sizeClasses[size]} ${className}`}>
      <span className="text-amber-500">🛡</span>
      <div>
        <span className="font-semibold text-amber-800 dark:text-amber-300">
          {durationLabel} {typeLabel} Guarantee
        </span>
        {size !== 'sm' && (
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            {guarantee.description}
          </p>
        )}
      </div>
    </div>
  );
}
