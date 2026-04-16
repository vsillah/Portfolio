'use client'

import { useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { buildAdminReturnPath } from '@/lib/admin-return-context'

/** Current admin location (pathname + query, without `returnTo`) for `buildLinkWithReturn` second argument. */
export function useAdminReturnPath(): string {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return useMemo(
    () => buildAdminReturnPath(pathname, searchParams.toString()),
    [pathname, searchParams],
  )
}
