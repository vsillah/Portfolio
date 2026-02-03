import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/prompts
 * List all system prompts (admin only)
 */
export async function GET(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/prompts/route.ts:13',message:'GET /api/admin/prompts: Starting',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/prompts/route.ts:18',message:'GET /api/admin/prompts: Auth error',data:{error:authResult.error,status:authResult.status},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    // Fetch all prompts
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/prompts/route.ts:27',message:'GET /api/admin/prompts: Querying prompts',data:{userId:authResult.user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    const { data: prompts, error } = await supabaseAdmin
      .from('system_prompts')
      .select('*')
      .order('key')

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/prompts/route.ts:33',message:'GET /api/admin/prompts: Prompts query result',data:{hasPrompts:!!prompts,promptsCount:prompts?.length,hasError:!!error,errorCode:error?.code,errorMessage:error?.message,errorDetails:error?.details},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (error) {
      console.error('Error fetching prompts:', error)
      return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/prompts/route.ts:40',message:'GET /api/admin/prompts: Success',data:{promptsCount:prompts?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
    
    return NextResponse.json({ prompts })
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/prompts/route.ts:45',message:'GET /api/admin/prompts: Exception caught',data:{errorMessage:error instanceof Error ? error.message : String(error),errorName:error instanceof Error ? error.name : 'Unknown',errorStack:error instanceof Error ? error.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
    console.error('Error in GET /api/admin/prompts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/prompts
 * Create a new system prompt (admin only)
 */
export async function POST(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const { key, name, description, prompt, config, is_active } = body

    if (!key || !name || !prompt) {
      return NextResponse.json(
        { error: 'Key, name, and prompt are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('system_prompts')
      .insert({
        key,
        name,
        description,
        prompt,
        config: config || {},
        is_active: is_active ?? true,
        created_by: authResult.user.id,
        updated_by: authResult.user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A prompt with this key already exists' },
          { status: 409 }
        )
      }
      console.error('Error creating prompt:', error)
      return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 })
    }

    return NextResponse.json({ prompt: data }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/prompts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
