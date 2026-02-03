import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/chat-eval/diagnoses/[id]/apply-code
 * Generate code change instructions or attempt limited auto-apply
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { recommendation_id } = body

    // Fetch diagnosis
    const { data: diagnosis, error: fetchError } = await supabaseAdmin
      .from('error_diagnoses')
      .select('recommendations, session_id')
      .eq('id', id)
      .single()

    if (fetchError || !diagnosis) {
      return NextResponse.json(
        { error: 'Diagnosis not found' },
        { status: 404 }
      )
    }

    // Find the code recommendation
    const recommendations = diagnosis.recommendations || []
    const recommendation = recommendation_id
      ? recommendations.find((rec: any) => rec.id === recommendation_id)
      : recommendations.find((rec: any) => rec.type === 'code')

    if (!recommendation || recommendation.type !== 'code') {
      return NextResponse.json(
        { error: 'Code recommendation not found' },
        { status: 404 }
      )
    }

    const targetFile = recommendation.changes.target
    const canAutoApply = recommendation.changes.can_auto_apply

    // For code changes, we primarily generate instructions
    // Only attempt auto-apply for very simple cases (config values, constants)
    let instructions = recommendation.application_instructions || ''
    let canAutoApplyNow = false

    // Check if it's a simple config change we can handle
    if (canAutoApply && targetFile.includes('.env') || targetFile.includes('config')) {
      // For config files, provide clear instructions
      instructions = `To apply this code change:

1. Open the file: ${targetFile}
2. Find the section mentioned in the recommendation
3. Replace the old value with the new value:
   Old: ${recommendation.changes.old_value || 'See recommendation'}
   New: ${recommendation.changes.new_value}
4. Save the file
5. Restart the application if needed

**Note:** This is a configuration change. Ensure you understand the impact before applying.`
    } else {
      // For code files, provide detailed instructions
      instructions = recommendation.application_instructions || `To apply this code change:

**File:** ${targetFile}
**Change Type:** ${recommendation.priority === 'high' ? 'High Priority' : 'Standard'}

**Description:**
${recommendation.description}

**Steps:**
1. Open ${targetFile} in your code editor
2. Locate the code section mentioned in the recommendation
3. Apply the following change:
   ${recommendation.changes.old_value ? `Replace:\n\`\`\`\n${recommendation.changes.old_value}\n\`\`\`\n\nWith:\n\`\`\`\n${recommendation.changes.new_value}\n\`\`\`` : `Add/Modify:\n\`\`\`\n${recommendation.changes.new_value}\n\`\`\``}
4. Test the changes thoroughly
5. Commit the changes to version control

**Verification:**
After applying, verify the fix resolves the error by:
- Testing the specific scenario that caused the error
- Running any relevant tests
- Checking that no new errors are introduced`
    }

    // Record that instructions were generated
    await supabaseAdmin
      .from('fix_applications')
      .insert({
        diagnosis_id: id,
        change_type: 'code_file',
        target_identifier: targetFile,
        old_value: recommendation.changes.old_value,
        new_value: recommendation.changes.new_value,
        application_method: 'manual',
        applied_by: authResult.user.id,
        verification_status: 'pending',
        verification_notes: 'Instructions generated, awaiting manual application',
      })

    return NextResponse.json({
      recommendation_id: recommendation.id,
      target_file: targetFile,
      can_auto_apply: canAutoApplyNow,
      instructions,
      changes: {
        old_value: recommendation.changes.old_value,
        new_value: recommendation.changes.new_value,
      },
      priority: recommendation.priority,
    })
  } catch (error) {
    console.error('Apply code error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
