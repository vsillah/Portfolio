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
  const glyph = avatar.motif.slice(0, 1).toUpperCase()

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
      <Image
        src={avatar.imagePath}
        alt=""
        aria-hidden="true"
        fill
        sizes="56px"
        unoptimized
        className="absolute inset-0 h-full w-full object-cover"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className="absolute inset-0 h-full w-full opacity-0"
      >
        <circle cx="32" cy="27" r="13" fill="#0b1726" opacity="0.92" />
        <path d="M17 58c2.8-11.2 8.1-16.8 15-16.8S44.2 46.8 47 58" fill="#101f33" opacity="0.96" />
        <path d="M18 27c2.4-11 7.4-16.5 14-16.5S43.6 16 46 27c-5.2-2.2-9.9-3.3-14-3.3S23.2 24.8 18 27Z" fill={tone.ring} opacity="0.5" />
        <path d="M22 18c3.2-3.8 6.6-5.7 10-5.7s6.8 1.9 10 5.7" fill="none" stroke={tone.mark} strokeWidth="2.5" strokeLinecap="round" opacity="0.72" />
        <circle cx="25" cy="28" r="1.8" fill={tone.mark} opacity="0.8" />
        <circle cx="39" cy="28" r="1.8" fill={tone.mark} opacity="0.8" />
        <path d="M27 35c3.2 2.4 6.5 2.4 10 0" fill="none" stroke={tone.mark} strokeWidth="2" strokeLinecap="round" opacity="0.62" />
        <circle cx="50" cy="14" r="8" fill="#07111f" opacity="0.92" />
        <circle cx="50" cy="14" r="7.2" fill="none" stroke={tone.ring} strokeWidth="1.5" opacity="0.7" />
        <text x="50" y="18" textAnchor="middle" fontSize="9" fontWeight="700" fill={tone.mark}>{glyph}</text>
      </svg>
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
      <span className="absolute bottom-1 left-1 z-10 rounded bg-black/35 px-1 leading-4">{avatar.initials}</span>
    </div>
  )
}
