'use client';

import { COMPARISON_DATA, type ComparisonRow } from '@/lib/pricing-model';

interface ComparisonChecklistProps {
  className?: string;
}

function renderCell(value: boolean | string) {
  if (value === true) return <span className="text-green-500 font-medium">Yes</span>;
  if (value === false) return <span className="text-gray-300 dark:text-gray-600">—</span>;
  return <span className="text-gray-600 dark:text-gray-400 text-sm">{value}</span>;
}

export function ComparisonChecklist({ className = '' }: ComparisonChecklistProps) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 ${className}`}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Capability</th>
            <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Typical Agency</th>
            <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Ottley / Morningside</th>
            <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Saraev / LeftClick</th>
            <th className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">Amadutown</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_DATA.map((row: ComparisonRow, idx) => (
            <tr
              key={row.capability}
              className={`border-b border-gray-100 dark:border-gray-800 ${
                idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''
              }`}
            >
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.capability}</td>
              <td className="px-4 py-3">{renderCell(row.typicalAgency)}</td>
              <td className="px-4 py-3">{renderCell(row.ottleyMorningside)}</td>
              <td className="px-4 py-3">{renderCell(row.saraevLeftClick)}</td>
              <td className="px-4 py-3">
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {typeof row.amadutown === 'boolean'
                    ? (row.amadutown ? 'Yes' : '—')
                    : row.amadutown}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
