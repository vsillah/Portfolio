import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'

const http = httpRouter()

// The only public Convex entry point. Its shared key is held by Portfolio server
// routes and this separate Portfolio-owned Convex deployment, never by a browser.
http.route({ path: '/activation', method: 'POST', handler: httpAction(async (ctx, request) => {
  const expected = process.env.PORTFOLIO_ACTIVATION_BRIDGE_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!expected || expected.length < 32 || !supplied || supplied.length !== expected.length) return new Response(null, { status: 403 })
  let difference = 0
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i)
  if (difference !== 0) return new Response(null, { status: 403 })
  if (Number(request.headers.get('content-length') || 0) > 8192) return new Response(null, { status: 413 })
  try {
    const body = await request.json() as { operation?: string; args?: Record<string, unknown> }
    if (!body || typeof body.args !== 'object' || !body.args || Array.isArray(body.args)) return new Response(null, { status: 400 })
    const args = body.args
    let result: unknown
    switch (body.operation) {
      case 'budget': result = await ctx.runMutation(internal.activation.budget, args as never); break
      case 'intake': result = await ctx.runMutation(internal.activation.intake, args as never); break
      case 'redeem': result = await ctx.runMutation(internal.activation.redeem, args as never); break
      case 'hasGrant': result = await ctx.runQuery(internal.activation.hasGrant, { ...args, now: Date.now() } as never); break
      case 'issueHandoff': result = await ctx.runMutation(internal.activation.issueHandoff, args as never); break
      case 'resolveCode': result = await ctx.runQuery(internal.activation.resolveCode, { ...args, now: Date.now() } as never); break
      case 'exchangeHandoff': result = await ctx.runMutation(internal.activation.exchangeHandoff, args as never); break
      case 'resolveHandle': result = await ctx.runQuery(internal.activation.resolveHandle, { ...args, now: Date.now() } as never); break
      case 'operator': result = await ctx.runMutation(internal.activation.operator, args as never); break
      case 'revokeUndelivered': result = await ctx.runMutation(internal.activation.revokeUndelivered, args as never); break
      case 'snapshot': result = await ctx.runQuery(internal.activation.snapshot, { now: Date.now() }); break
      default: return new Response(null, { status: 404 })
    }
    return Response.json({ result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Activation operation failed.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  }
}) })

export default http
