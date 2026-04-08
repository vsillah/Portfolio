/**
 * Admin API — Single Chatbot Test Question operations
 *
 * DELETE → remove a custom question by ID
 * PATCH  → update a custom question
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { error } = await supabaseAdmin
    .from('chatbot_test_questions')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.question !== undefined) updates.question = body.question.trim()
  if (body.category !== undefined) updates.category = body.category
  if (body.expectedKeywords !== undefined) updates.expected_keywords = body.expectedKeywords
  if (body.expectsBoundary !== undefined) updates.expects_boundary = body.expectsBoundary
  if (body.triggersDiagnostic !== undefined) updates.triggers_diagnostic = body.triggersDiagnostic
  if (body.tags !== undefined) updates.tags = body.tags

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('chatbot_test_questions')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ question: data })
}
