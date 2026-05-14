import { getAgentAvatar, getAvatarToneStyles } from '@/lib/agent-avatars'

export default function AgentAvatar({
  agentKey,
  size = 'md',
  className = '',
}: {
  agentKey?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const avatar = getAgentAvatar(agentKey)
  const tone = getAvatarToneStyles(avatar.tone)
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-14 w-14 text-sm' : 'h-11 w-11 text-xs'

  return (
    <div
      role="img"
      aria-label={avatar.label}
      title={`${avatar.label} - ${avatar.culturalCue}`}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border font-semibold tracking-wide shadow-[0_0_24px_rgba(216,180,44,0.12)] ${sizeClass} ${className}`}
      style={{
        borderColor: tone.ring,
        background: `radial-gradient(circle at 35% 20%, ${tone.mark}44, transparent 35%), linear-gradient(145deg, ${tone.wash}, #07111f 78%)`,
        color: tone.mark,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-2 top-1 h-1 rounded-full opacity-75"
        style={{ backgroundColor: tone.ring }}
      />
      <span
        aria-hidden="true"
        className="absolute bottom-1 right-1 h-3 w-3 rounded-full opacity-50"
        style={{ backgroundColor: tone.mark }}
      />
      <span className="relative z-10">{avatar.initials}</span>
    </div>
  )
}
