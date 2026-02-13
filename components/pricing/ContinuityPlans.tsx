'use client';

import type { ContinuityPlan } from '@/lib/pricing-model';
import { formatCurrency } from '@/lib/pricing-model';

interface ContinuityPlansProps {
  plans: ContinuityPlan[];
  className?: string;
}

export function ContinuityPlans({ plans, className = '' }: ContinuityPlansProps) {
  return (
    <div className={`grid gap-6 md:grid-cols-3 ${className}`}>
      {plans.map((plan) => (
        <div
          key={plan.id}
          className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <h4 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{plan.description}</p>

          <div className="mt-4">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(plan.pricePerMonth)}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
          </div>

          <ul className="mt-6 flex-1 space-y-2">
            {plan.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="mt-0.5 flex-shrink-0 text-green-500">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <a
            href="#contact"
            className="mt-6 block w-full rounded-lg border border-gray-300 bg-white py-2.5 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Learn More
          </a>
        </div>
      ))}
    </div>
  );
}
