import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sales/in-person-diagnostic/generate-insights
 * Use AI to generate insights, scores, and recommendations from
 * in-person diagnostic data filled in by the sales rep.
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (isAuthError(admin)) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  try {
    const body = await request.json()
    const { audit_id, client_name, client_company, diagnostic_data } = body

    if (!audit_id || !diagnostic_data) {
      return NextResponse.json({ error: 'audit_id and diagnostic_data are required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    // Build a prompt from the diagnostic data
    const sections: string[] = []
    if (diagnostic_data.business_challenges && Object.keys(diagnostic_data.business_challenges).length > 0) {
      sections.push(`Business Challenges: ${JSON.stringify(diagnostic_data.business_challenges)}`)
    }
    if (diagnostic_data.tech_stack && Object.keys(diagnostic_data.tech_stack).length > 0) {
      sections.push(`Tech Stack: ${JSON.stringify(diagnostic_data.tech_stack)}`)
    }
    if (diagnostic_data.automation_needs && Object.keys(diagnostic_data.automation_needs).length > 0) {
      sections.push(`Automation Needs: ${JSON.stringify(diagnostic_data.automation_needs)}`)
    }
    if (diagnostic_data.ai_readiness && Object.keys(diagnostic_data.ai_readiness).length > 0) {
      sections.push(`AI Readiness: ${JSON.stringify(diagnostic_data.ai_readiness)}`)
    }
    if (diagnostic_data.budget_timeline && Object.keys(diagnostic_data.budget_timeline).length > 0) {
      sections.push(`Budget & Timeline: ${JSON.stringify(diagnostic_data.budget_timeline)}`)
    }
    if (diagnostic_data.decision_making && Object.keys(diagnostic_data.decision_making).length > 0) {
      sections.push(`Decision Making: ${JSON.stringify(diagnostic_data.decision_making)}`)
    }

    const prompt = `You are a sales intelligence analyst. Based on the following diagnostic data gathered during an in-person sales conversation${client_name ? ` with ${client_name}` : ''}${client_company ? ` from ${client_company}` : ''}, generate:

1. A brief diagnostic summary (2-3 sentences)
2. 3-5 key insights about this prospect
3. 3-5 recommended next actions for the sales team
4. An urgency score (1-10, where 10 is most urgent)
5. An opportunity score (1-10, where 10 is highest opportunity)

Diagnostic Data:
${sections.join('\n')}

Respond in JSON format:
{
  "diagnostic_summary": "...",
  "key_insights": ["...", "..."],
  "recommended_actions": ["...", "..."],
  "urgency_score": 7,
  "opportunity_score": 8,
  "sales_notes": "Brief note about the overall sales opportunity"
}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a sales intelligence analyst. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('OpenAI API error:', errText)
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
    }

    const aiResult = await response.json()
    const content = aiResult.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No AI response' }, { status: 500 })
    }

    let parsed: {
      diagnostic_summary?: string
      key_insights?: string[]
      recommended_actions?: string[]
      urgency_score?: number
      opportunity_score?: number
      sales_notes?: string
    }
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('Failed to parse AI response:', content)
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // Update the diagnostic audit with generated insights
    const { error: updateError } = await supabaseAdmin
      .from('diagnostic_audits')
      .update({
        diagnostic_summary: parsed.diagnostic_summary || null,
        key_insights: parsed.key_insights || [],
        recommended_actions: parsed.recommended_actions || [],
        urgency_score: parsed.urgency_score || null,
        opportunity_score: parsed.opportunity_score || null,
        sales_notes: parsed.sales_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', audit_id)

    if (updateError) {
      console.error('Failed to update audit with insights:', updateError)
      // Non-fatal: return the insights even if save failed
    }

    return NextResponse.json({
      summary: parsed.diagnostic_summary,
      insights: parsed.key_insights || [],
      actions: parsed.recommended_actions || [],
      urgency_score: parsed.urgency_score,
      opportunity_score: parsed.opportunity_score,
      sales_notes: parsed.sales_notes,
    })
  } catch (error) {
    console.error('Generate insights API error:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
