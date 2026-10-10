import Image from 'next/image'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface CatalogCardProps {
  title: string
  description: string | null
  href: string
  imageUrl?: string | null
  imageAlt?: string
  badges: string[]
  cornerLabel: string
  ctaLabel: string
  icon: LucideIcon
  index: number
}

export default function CatalogCard({
  title,
  description,
  href,
  imageUrl,
  imageAlt = title,
  badges,
  cornerLabel,
  ctaLabel,
  icon: Icon,
  index,
}: CatalogCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#121E31]/10 bg-white/[0.88] shadow-[0_18px_42px_rgba(18,30,49,0.10)] backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:border-radiant-gold/35 hover:shadow-[0_22px_54px_rgba(18,30,49,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold focus-visible:ring-offset-4 focus-visible:ring-offset-[#eef2f7] dark:border-radiant-gold/5 dark:bg-silicon-slate/40 dark:shadow-none dark:hover:border-radiant-gold/20 dark:focus-visible:ring-offset-imperial-navy reveal-on-scroll is-visible"
      style={{ transitionDelay: `${index * 0.1}s` }}
    >
      <div className="relative h-64 flex-shrink-0 overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted dark:bg-background">
            <Icon className="text-radiant-gold/35 dark:text-radiant-gold/20" size={52} aria-hidden="true" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#121E31]/20 via-transparent to-transparent dark:from-imperial-navy/50" />

        <div className="absolute left-6 top-6 flex max-w-[calc(100%-3rem)] flex-wrap gap-2">
          {badges.map((badge, badgeIndex) => (
            <span
              key={badge}
              className={badgeIndex === 0
                ? 'rounded-full border border-radiant-gold/25 bg-white/90 px-3 py-1 font-heading text-[10px] uppercase tracking-widest text-[#725A16] backdrop-blur-md dark:border-radiant-gold/20 dark:bg-background/80 dark:text-radiant-gold'
                : 'rounded-full bg-radiant-gold px-3 py-1 font-heading text-[10px] font-bold uppercase tracking-widest text-imperial-navy'}
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="absolute bottom-6 right-6 rounded-full border border-radiant-gold/25 bg-white/[0.92] px-4 py-2 font-heading text-sm tracking-tight text-[#725A16] backdrop-blur-md dark:border-radiant-gold/20 dark:bg-background/90 dark:text-radiant-gold">
          {cornerLabel}
        </div>
      </div>

      <div className="flex flex-grow flex-col p-8">
        <h3 className="mb-3 font-premium text-2xl text-[#121E31] transition-colors group-hover:text-[#725A16] dark:text-foreground dark:group-hover:text-radiant-gold">
          {title}
        </h3>
        {description && (
          <p className="mb-8 line-clamp-3 font-body text-sm leading-6 text-[#475569] dark:text-muted-foreground/90">
            {description}
          </p>
        )}

        <div className="mt-auto flex w-full items-center justify-center gap-3 rounded-full border border-[#121E31]/[0.14] py-3 text-[#121E31]/[0.78] transition-all duration-300 group-hover:border-radiant-gold group-hover:bg-radiant-gold group-hover:text-imperial-navy dark:border-radiant-gold/20 dark:text-foreground dark:group-hover:text-imperial-navy">
          <Icon size={14} aria-hidden="true" />
          <span className="font-heading text-[10px] uppercase tracking-widest">{ctaLabel}</span>
        </div>
      </div>
    </Link>
  )
}
