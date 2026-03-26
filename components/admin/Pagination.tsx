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
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-platinum-white/50">
        {rangeStart}–{rangeEnd} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          className="px-2.5 py-1 text-sm rounded-lg bg-silicon-slate hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        {pageNumbers.map((p, idx) =>
          p === 'ellipsis' ? (
            <span key={`e-${idx}`} className="px-1 text-xs text-platinum-white/30">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              disabled={loading}
              className={`px-2.5 py-1 text-sm rounded-lg ${
                p === page
                  ? 'bg-cyan-700 text-white'
                  : 'bg-silicon-slate hover:bg-gray-600'
              } disabled:opacity-50`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || loading}
          className="px-2.5 py-1 text-sm rounded-lg bg-silicon-slate hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}
