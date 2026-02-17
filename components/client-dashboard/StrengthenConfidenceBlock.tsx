'use client'

import { CATEGORY_LABELS, type AssessmentCategory } from '@/lib/assessment-scoring'
import { HelpCircle, ListChecks } from 'lucide-react'

interface StrengthenConfidenceBlockProps {
  /** Per-category questions from the diagnostic (specific questions to answer) */
  strengthenQuestions: Partial<Record<AssessmentCategory, string[]>>
  /** Milestone titles from onboarding template (steps during engagement) */
  engagementSteps: string[]
}

export default function StrengthenConfidenceBlock({
  strengthenQuestions,
  engagementSteps,
}: StrengthenConfidenceBlockProps) {
  const hasQuestions = Object.keys(strengthenQuestions).length > 0

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        What will strengthen confidence
      </h3>
      <div className="space-y-4">
        {hasQuestions && (
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2">
              <HelpCircle size={12} />
              Questions you can answer in your assessment
            </p>
            <ul className="space-y-2">
              {(Object.keys(CATEGORY_LABELS) as AssessmentCategory[]).map((cat) => {
                const questions = strengthenQuestions[cat]
                if (!questions?.length) return null
                return (
                  <li key={cat} className="text-sm">
                    <span className="text-gray-400 font-medium">
                      {CATEGORY_LABELS[cat]}:
                    </span>{' '}
                    <span className="text-gray-300">
                      {questions.map((q, i) => (
                        <span key={i}>
                          {i > 0 && ' • '}
                          {q}
                        </span>
                      ))}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {engagementSteps.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2">
              <ListChecks size={12} />
              Steps during your engagement
            </p>
            <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
              {engagementSteps.map((title, i) => (
                <li key={i}>{title}</li>
              ))}
            </ul>
          </div>
        )}
        {!hasQuestions && engagementSteps.length === 0 && (
          <p className="text-gray-500 text-sm">
            Complete your assessment and start your engagement to see personalized recommendations.
          </p>
        )}
      </div>
    </div>
  )
}
