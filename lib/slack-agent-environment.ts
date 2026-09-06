/** Source identity for Slack cards. Never infer a hosted database from NODE_ENV. */
export type SlackAgentEnvironment = 'production' | 'staging' | 'preview' | 'local'
export type SlackAgentSource = { sourceEnvironment: SlackAgentEnvironment; sourceOrigin: string; hosted: boolean }
type Environment = Record<string, string | undefined>

export function getSlackAgentEnvironment(env: Environment = process.env): SlackAgentEnvironment {
  const publicTier = env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase()
  const privateTier = env.APP_ENV?.trim().toLowerCase()
  if (publicTier && privateTier && publicTier !== privateTier) throw new Error('Conflicting Slack APP_ENV provenance.')
  const tier = publicTier || privateTier
  const hosted = Boolean(env.VERCEL || env.VERCEL_ENV || env.NODE_ENV === 'production')
  if (!tier && !hosted) return 'local'
  if (!tier || !['production', 'staging', 'preview', 'development', 'local'].includes(tier)) {
    throw new Error('Explicit Slack APP_ENV provenance is required.')
  }
  if (env.VERCEL_ENV === 'preview') {
    if (tier === 'production') throw new Error('Production APP_ENV conflicts with preview hosting.')
    return 'preview'
  }
  if (tier === 'development' || tier === 'local') {
    if (hosted) throw new Error('Local Slack provenance conflicts with hosted runtime.')
    return 'local'
  }
  return tier as SlackAgentEnvironment
}

function origin(value: string | undefined, local: boolean): string {
  if (!value) throw new Error('Source-specific Slack origin is not configured.')
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Slack origin must be a bare origin.')
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Slack origin must use HTTPS.')
  return url.origin
}

export function getSlackAgentSource(env: Environment = process.env): SlackAgentSource {
  const sourceEnvironment = getSlackAgentEnvironment(env)
  const local = sourceEnvironment === 'local'
  const scoped = env[`SLACK_AGENT_OPS_${sourceEnvironment.toUpperCase()}_BASE_URL`]
  const productionUrl = env.SLACK_AGENT_OPS_PRODUCTION_BASE_URL || env.NEXT_PUBLIC_BASE_URL || env.PORTFOLIO_BASE_URL || env.NEXT_PUBLIC_SITE_URL
  const deploymentUrl = env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined
  // Nonproduction never inherits generic production URL variables.
  const sourceOrigin = origin(scoped || (sourceEnvironment === 'production' ? productionUrl : deploymentUrl) || (local ? 'http://localhost:3000' : undefined), local)
  if (sourceEnvironment !== 'production') {
    const productionOrigin = productionUrl ? origin(productionUrl, local) : 'https://amadutown.com'
    const hostname = new URL(sourceOrigin).hostname
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
    if ((!loopback && sourceOrigin === productionOrigin) || ['amadutown.com', 'www.amadutown.com'].includes(hostname)) {
      throw new Error('Nonproduction Slack origin cannot use production.')
    }
  }
  return { sourceEnvironment, sourceOrigin, hosted: !local }
}

export function getSlackAgentDeliveryConfig(env: Environment = process.env) {
  const source = getSlackAgentSource(env)
  if (env.SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED !== 'true') throw new Error('Slack notification delivery is disabled.')
  const prefix = `SLACK_AGENT_OPS_${source.sourceEnvironment.toUpperCase()}`
  const channel = env[`${prefix}_CHANNEL_ID`] || (source.sourceEnvironment === 'production' ? env.SLACK_AGENT_OPS_CHANNEL_ID : undefined)
  const token = env[`${prefix}_BOT_TOKEN`] || (source.sourceEnvironment === 'production' ? env.SLACK_BOT_TOKEN : undefined)
  if (!channel || !token) throw new Error('Source-specific Slack bot token and channel ID are required; webhook delivery has no linked receipt.')
  if (source.sourceEnvironment !== 'production' && [env.SLACK_AGENT_OPS_PRODUCTION_CHANNEL_ID, env.SLACK_AGENT_OPS_CHANNEL_ID, env.SLACK_AGENT_OPS_CHANNEL].filter(Boolean).includes(channel)) {
    throw new Error('Nonproduction Slack destination cannot use production.')
  }
  return { ...source, channel, token }
}
