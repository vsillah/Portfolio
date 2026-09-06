export type SlackAgentActor = {
  userId?: string | null
  userName?: string | null
  teamId?: string | null
}

export function isLocalSlackDevelopment() {
  return (
    ['development', 'test'].includes(process.env.NODE_ENV || '') &&
    !process.env.VERCEL &&
    !process.env.VERCEL_ENV &&
    (!process.env.APP_ENV || ['local', 'development', 'test'].includes(process.env.APP_ENV)) &&
    (!process.env.NEXT_PUBLIC_APP_ENV || ['local', 'development', 'test'].includes(process.env.NEXT_PUBLIC_APP_ENV))
  )
}

export function allowedSlackUserIds() {
  const raw = process.env.SLACK_AGENT_OPS_ALLOWED_USER_IDS || process.env.SLACK_AGENT_ALLOWED_USER_IDS || ''
  return new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))
}

// Hosted deployments require the Slack workspace ID (T...), not its name or URL.
// Set SLACK_AGENT_OPS_TEAM_ID and SLACK_AGENT_OPS_ALLOWED_USER_IDS per deployment;
// signing verification remains mandatory at each HTTP entry point.
export function requireAuthorizedSlackActor(actor: SlackAgentActor) {
  const local = isLocalSlackDevelopment()
  const expectedTeam = process.env.SLACK_AGENT_OPS_TEAM_ID?.trim()
  const deny = (text: string) => ({ ok: false as const, text: `Slack action rejected: ${text}` })
  if (typeof actor.userId !== 'string' || !actor.userId.trim()) return deny('missing Slack user id.')
  if (!expectedTeam && !local) {
    return deny('configure SLACK_AGENT_OPS_TEAM_ID with the intended Slack workspace ID for this deployment before using Agent Ops.')
  }
  if (expectedTeam && actor.teamId !== expectedTeam) {
    return deny('workspace does not match SLACK_AGENT_OPS_TEAM_ID. Use the configured workspace and its Agent Ops app.')
  }
  const allowed = allowedSlackUserIds()
  if (!allowed.has(actor.userId) && !(local && allowed.size === 0)) {
    return deny('this Slack user is not configured for Agent Ops. Configure SLACK_AGENT_OPS_ALLOWED_USER_IDS for the intended operator.')
  }
  return {
    ok: true as const,
    userId: actor.userId,
    teamId: actor.teamId ?? null,
    actorLabel: typeof actor.userName === 'string' && actor.userName.trim() ? actor.userName : actor.userId,
  }
}
