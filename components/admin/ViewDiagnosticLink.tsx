'use client'

import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { buildLinkWithReturn } from '@/lib/admin-return-context'

const defaultClassName =
  'text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:underline shrink-0'

export type ViewDiagnosticLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  auditId: string | null | undefined
  /** Validated by `buildLinkWithReturn` — typically `useAdminReturnPath()` or a static `/admin/...` path */
  returnPath: string
  className?: string
  /** Default true so proposal/script surfaces stay open during review */
  openInNewTab?: boolean
  children?: ReactNode
}

export function ViewDiagnosticLink({
  auditId,
  returnPath,
  className,
  openInNewTab = true,
  children,
  ...linkRest
}: ViewDiagnosticLinkProps) {
  const id = typeof auditId === 'string' ? auditId.trim() : ''
  if (!id) return null

  const href = buildLinkWithReturn(`/admin/sales/${id}`, returnPath)

  return (
    <Link
      href={href}
      className={className ?? defaultClassName}
      {...(openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...linkRest}
    >
      {children ?? 'View diagnostic'}
    </Link>
  )
}
