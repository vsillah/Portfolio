import Image from 'next/image'
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
      className={`relative flex shrink-0 items-center justify-center rounded-xl border font-semibold tracking-wide shadow-[0_0_24px_rgba(216,180,44,0.12)] ${sizeClass} ${className}`}
      style={{
        borderColor: tone.ring,
        background: `radial-gradient(circle at 35% 20%, ${tone.mark}44, transparent 35%), linear-gradient(145deg, ${tone.wash}, #07111f 78%)`,
        color: tone.mark,
      }}
    >
      <Image
        src={avatar.imagePath}
        alt=""
        aria-hidden="true"
        fill
        sizes="56px"
        unoptimized
        className="absolute inset-[2px] h-[calc(100%-4px)] w-[calc(100%-4px)] object-contain"
      />
    </div>
  )
}
