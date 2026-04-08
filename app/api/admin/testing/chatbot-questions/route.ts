/**
 * Admin API — Chatbot Test Questions CRUD
 *
 * GET  → list all custom questions (from DB) merged with built-in bank
 * POST → create a new custom question (persisted to DB)
 *
 * Custom questions are stored in `chatbot_test_questions` table alongside
 * the built-in bank from lib/testing/chatbot-questions.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  CHATBOT_TEST_QUESTIONS,
  QUESTION_CATEGORIES,
  getCategoryStats,
  TOTAL_QUESTION_COUNT,
} from '@/lib/testing/chatbot-questions'

export const dynamic = 'force-dynamic'

// GET — return built-in + custom questions
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const tag = searchParams.get('tag')
  const source = searchParams.get('source') // 'builtin' | 'custom' | null (both)

  let builtinQuestions = [...CHATBOT_TEST_QUESTIONS]
  if (category) builtinQuestions = builtinQuestions.filter(q => q.category === category)
  if (tag) builtinQuestions = builtinQuestions.filter(q => q.tags.includes(tag))

  let customQuestions: typeof CHATBOT_TEST_QUESTIONS = []
  try {
    let query = supabaseAdmin
      .from('chatbot_test_questions')
      .select('*')
      .order('created_at', { ascending: false })

    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (!error && data) {
      customQuestions = data.map((row: {
        id: string
        category: string
        question: string
        expected_keywords: string[] | null
        expects_boundary: boolean | null
        triggers_diagnostic: boolean | null
        tags: string[] | null
      }) => ({
        id: row.id,
        category: row.category as typeof CHATBOT_TEST_QUESTIONS[number]['category'],
        question: row.question,
        expectedKeywords: row.expected_keywords || undefined,
        expectsBoundary: row.expects_boundary || undefined,
        triggersDiagnostic: row.triggers_diagnostic || undefined,
        tags: row.tags || [],
        _source: 'custom' as const,
      }))
      if (tag) customQuestions = customQuestions.filter(q => q.tags.includes(tag))
    }
  } catch {
    // Table may not exist yet — return built-in only
  }

  const builtinWithSource = builtinQuestions.map(q => ({ ...q, _source: 'builtin' as const }))
  const combined = source === 'builtin' ? builtinWithSource
    : source === 'custom' ? customQuestions
    : [...builtinWithSource, ...customQuestions]

  return NextResponse.json({
    questions: combined,
    categories: QUESTION_CATEGORIES,
    stats: {
      builtinCount: TOTAL_QUESTION_COUNT,
      customCount: customQuestions.length,
      totalCount: TOTAL_QUESTION_COUNT + customQuestions.length,
      byCategory: getCategoryStats(),
    },
  })
}

// POST — create a custom question
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { category, question, expectedKeywords, expectsBoundary, triggersDiagnostic, tags } = body

  if (!category || !question) {
    return NextResponse.json({ error: 'category and question are required' }, { status: 400 })
  }

  const validCategories = QUESTION_CATEGORIES.map(c => c.id)
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('chatbot_test_questions')
    .insert({
      category,
      question: question.trim(),
      expected_keywords: expectedKeywords || null,
      expects_boundary: expectsBoundary || false,
      triggers_diagnostic: triggersDiagnostic || false,
      tags: tags || [],
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({
        error: 'chatbot_test_questions table does not exist. Run the migration first.',
        migrationHint: 'See migrations/ for the chatbot_test_questions table creation script.',
      }, { status: 500 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ question: data }, { status: 201 })
}
