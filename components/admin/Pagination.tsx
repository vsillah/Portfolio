'use client'

import React from 'react'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  loading?: boolean
  onPageChange: (page: number) => void
}

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  loading,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
      acc.push(p)
      return acc
    }, [])

  const rangeStart = (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground/90">
        {rangeStart}–{rangeEnd} of {total}
      </span>
      <div className="flex min-w-0 shrink-0 items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          className="rounded-lg bg-silicon-slate px-2.5 py-1 text-sm hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Prev
        </button>
        <div className="hidden items-center gap-1 sm:flex">
          {pageNumbers.map((p, idx) =>
            p === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-1 text-xs text-muted-foreground/70">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                disabled={loading}
                className={`rounded-lg px-2.5 py-1 text-sm ${
                  p === page
                    ? 'bg-cyan-700 text-white'
                    : 'bg-silicon-slate hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {p}
              </button>
            )
          )}
        </div>
        <span className="inline-flex h-8 shrink-0 items-center rounded-lg border border-silicon-slate/70 px-2 text-xs text-muted-foreground/90 sm:hidden">
          {page}/{totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || loading}
          className="rounded-lg bg-silicon-slate px-2.5 py-1 text-sm hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  )
}
