'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Lightbulb, Target, FileText, TrendingUp } from 'lucide-react'

interface AssessmentDetailsProps {
  assessment: {
    diagnostic_summary: string | null
    key_insights: string[] | null
    recommended_actions: string[] | null
    business_challenges: Record<string, unknown>
    tech_stack: Record<string, unknown>
    automation_needs: Record<string, unknown>
    ai_readiness: Record<string, unknown>
    budget_timeline: Record<string, unknown>
    decision_making: Record<string, unknown>
  }
  valueReport?: {
    total_annual_value: number | null
    value_statements: unknown[]
  } | null
}

interface Section {
  key: string
  title: string
  icon: typeof FileText
  content: string | null
}

export default function AssessmentDetails({ assessment, valueReport }: AssessmentDetailsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('summary')

  // Build sections from assessment data
  const sections: Section[] = []

  if (assessment.diagnostic_summary) {
    sections.push({
      key: 'summary',
      title: 'Business Description',
      icon: FileText,
      content: assessment.diagnostic_summary,
    })
  }

  // Extract text from category JSONB
  const challengeText = extractTextFromCategory(assessment.business_challenges)
  if (challengeText) {
    sections.push({
      key: 'challenges',
      title: 'Problem Statement',
      icon: Target,
      content: challengeText,
    })
  }

  const techText = extractTextFromCategory(assessment.tech_stack)
  const automationText = extractTextFromCategory(assessment.automation_needs)
  if (techText || automationText) {
    sections.push({
      key: 'research',
      title: 'Research Conducted',
      icon: Lightbulb,
      content: [techText, automationText].filter(Boolean).join('\n\n'),
    })
  }

  if (valueReport?.total_annual_value) {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(valueReport.total_annual_value)

    sections.push({
      key: 'turnover',
      title: 'Annual Turnover & Products',
      icon: TrendingUp,
      content: `Based on our analysis, the identified gaps represent approximately ${formatted} in annual impact to your business.`,
    })
  }

  if (sections.length === 0) {
    return null
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Your Assessment Details
      </h3>
      <div className="space-y-2">
        {sections.map((section) => {
          const isExpanded = expandedSection === section.key
          const Icon = section.icon

          return (
            <div key={section.key} className="border border-gray-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : section.key)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-800/50 transition-colors text-left"
              >
                <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-300 flex-1">
                  {section.title}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {isExpanded && section.content && (
                <div className="px-3 pb-3">
                  <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                    {section.content}
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {/* Key Insights */}
        {assessment.key_insights && assessment.key_insights.length > 0 && (
          <div className="mt-3 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
            <h4 className="text-xs font-medium text-blue-400 uppercase mb-2">Key Insights</h4>
            <ul className="space-y-1">
              {assessment.key_insights.map((insight, i) => (
                <li key={i} className="text-xs text-blue-300/80 flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function extractTextFromCategory(data: Record<string, unknown> | null): string | null {
  if (!data || typeof data !== 'object') return null

  // Look for summary or description fields
  const textFields = ['summary', 'description', 'overview', 'analysis', 'notes']
  for (const field of textFields) {
    if (typeof data[field] === 'string' && (data[field] as string).length > 0) {
      return data[field] as string
    }
  }

  // Concatenate all string values as fallback
  const strings = Object.values(data)
    .filter((v): v is string => typeof v === 'string' && v.length > 10)
  return strings.length > 0 ? strings.join('\n\n') : null
}
