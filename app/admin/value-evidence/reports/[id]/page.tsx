'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Target,
  DollarSign,
  Clock,
  ShieldCheck,
  Users,
  Zap,
  FileText,
  Building2,
  Calendar,
  BookOpen,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatBenchmarkType(type: string): string {
  return type
    .replace(/^avg_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatBenchmarkValue(b: Benchmark): string {
  if (b.benchmark_type === 'avg_close_rate') {
    return `${(Number(b.value) * 100).toFixed(0)}%`
  }
  return formatCurrency(b.value)
}

const METHOD_ICONS: Record<string, typeof Clock> = {
  time_saved: Clock,
  error_reduction: ShieldCheck,
  revenue_acceleration: TrendingUp,
  opportunity_cost: Target,
  replacement_cost: Users,
}

function getMethodIcon(method?: string) {
  const Icon = method ? METHOD_ICONS[method] ?? DollarSign : DollarSign
  return Icon
}

/**
 * Strip the "Cost of Doing Nothing" section from the markdown since the
 * structured opportunity-area cards already cover the same content.
 * Removes from `## The Cost of Doing Nothing` up to (but not including) the
 * next `## ` heading or horizontal rule `---`.
 */
function stripDuplicateCostSection(md: string): string {
  return md.replace(
    /## The Cost of Doing Nothing\n[\s\S]*?(?=\n---|\n## |\n$)/,
    ''
  )
}

function normalizeStatement(vs: ValueStatement) {
  return {
    painPoint: vs.pain_point ?? vs.painPoint ?? 'Unnamed opportunity',
    annualValue: vs.annual_value ?? vs.annualValue ?? 0,
    calculationMethod: vs.calculation_method ?? vs.calculationMethod,
    formulaReadable: vs.formula_readable ?? vs.formulaReadable,
    evidenceSummary: vs.evidence_summary ?? vs.evidenceSummary,
    confidence: vs.confidence,
  }
}

interface ValueStatement {
  pain_point?: string
  painPoint?: string
  annual_value?: number
  annualValue?: number
  calculation_method?: string
  calculationMethod?: string
  formula_readable?: string
  formulaReadable?: string
  evidence_summary?: string
  evidenceSummary?: string
  confidence?: string
}

interface Report {
  id: string
  title: string
  summary_markdown: string
  value_statements: ValueStatement[]
  total_annual_value: number
  report_type?: string
  industry?: string
  company_size_range?: string
  created_at: string
}

interface Contact {
  id: number
  name: string
  email: string
  company: string | null
  industry: string | null
  employee_count: number | null
  lead_score: number | null
}

interface Benchmark {
  id: string
  industry: string
  company_size_range: string
  benchmark_type: string
  value: number
  source: string
  source_url: string | null
  year: number
  notes: string | null
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-10 text-xl font-bold text-white first:mt-0 border-b border-gray-700 pb-2">
      {children}
    </h2>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-8 text-lg font-semibold text-gray-200">
      {children}
    </h3>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-2 mt-6 text-base font-semibold text-gray-300">
      {children}
    </h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 text-gray-300 leading-relaxed">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-4 ml-6 list-disc space-y-2 text-gray-300">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-4 ml-6 list-decimal space-y-2 text-gray-300">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-emerald-500/60 pl-4 italic text-gray-400 my-4">
      {children}
    </blockquote>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="text-emerald-400 underline hover:text-emerald-300"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full border-collapse text-sm text-gray-300">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-gray-700 bg-gray-800/80 px-4 py-3 text-left font-semibold text-white">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-gray-700 px-4 py-3">{children}</td>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="border-b border-gray-700 last:border-0">{children}</tr>
  ),
}

export default function ValueReportPage() {
  const params = useParams()
  const id = params?.id as string
  const [report, setReport] = useState<Report | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchReport = async () => {
      setLoading(true)
      setError(null)
      try {
        const session = await getCurrentSession()
        if (!session?.access_token) {
          setError('Not authenticated')
          return
        }
        const res = await fetch(`/api/admin/value-evidence/reports/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error || `Failed to load report (${res.status})`)
          setReport(null)
          setContact(null)
          setBenchmarks([])
          return
        }
        const data = await res.json()
        setReport(data.report)
        setContact(data.contact || null)
        setBenchmarks(data.benchmarks || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report')
        setReport(null)
        setContact(null)
        setBenchmarks([])
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [id])

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white p-6 pb-24">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Value Evidence Pipeline', href: '/admin/value-evidence' },
          { label: 'Reports', href: '/admin/value-evidence' },
          { label: report?.title ?? 'Report', href: undefined },
        ]} />

        <div className="max-w-4xl mx-auto">
          <Link
            href="/admin/value-evidence"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Value Evidence
          </Link>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw size={32} className="animate-spin text-gray-500 mb-4" />
              <p className="text-gray-400">Loading report…</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <AlertCircle size={48} className="text-red-400 mb-4" />
              <p className="text-red-300 text-lg mb-2">{error}</p>
              <Link
                href="/admin/value-evidence"
                className="text-gray-400 hover:text-white"
              >
                Return to Value Evidence
              </Link>
            </div>
          )}

          {report && !loading && !error && (
            <article className="bg-gray-900/30 border border-gray-700/80 rounded-2xl overflow-hidden shadow-2xl">
              {/* Cover / Header */}
              <header className="relative overflow-hidden bg-gradient-to-br from-emerald-950/60 via-gray-900 to-gray-950 border-b border-gray-700/80 px-8 pt-10 pb-8">
                <div className="absolute inset-0 opacity-[0.03]">
                  <div className="absolute top-8 right-12 w-40 h-40 border-2 border-emerald-400 rounded-full" />
                  <div className="absolute bottom-8 left-16 w-24 h-24 border border-emerald-500 rounded-full" />
                  <div className="absolute top-1/2 left-1/3 w-32 h-32 border border-emerald-400/50 rounded-full" />
                </div>
                <div className="relative">
                  <p className="text-emerald-400/90 text-sm font-medium tracking-widest uppercase mb-2">
                    Confidential · Value Assessment
                  </p>
                  <h1 className="text-3xl font-bold text-white mb-6">
                    Amadutown Advisory Solutions
                  </h1>
                  <div className="h-px bg-gradient-to-r from-emerald-500/50 via-gray-600 to-transparent mb-6" />
                  <h2 className="text-2xl font-semibold text-gray-100 mb-4">
                    {report.title}
                  </h2>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                    {(report.industry || report.company_size_range) && (
                      <span className="flex items-center gap-1.5">
                        <Building2 size={16} className="text-gray-500" />
                        {[report.industry?.replace(/_/g, ' '), report.company_size_range]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar size={16} className="text-gray-500" />
                      {new Date(report.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    {report.report_type && (
                      <span className="px-2 py-0.5 bg-gray-700/80 rounded text-gray-300">
                        {report.report_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  {contact && (
                    <div className="mt-4 p-3 bg-gray-800/40 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Prepared for
                      </p>
                      <p className="text-gray-200 font-medium">
                        {contact.name}
                        {contact.company && (
                          <span className="text-gray-400 font-normal"> · {contact.company}</span>
                        )}
                        {contact.industry && (
                          <span className="text-gray-500 text-sm"> · {contact.industry}</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </header>

              {/* Executive summary stat cards */}
              <section className="px-8 py-6 border-b border-gray-700/80">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Estimated Annual Value at Risk
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                    <div className="p-2.5 bg-red-500/20 rounded-lg shrink-0">
                      <TrendingUp className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Cost of Inaction
                      </p>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(parseFloat(String(report.total_annual_value)))}
                      </p>
                      <p className="text-xs text-gray-400">per year</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                    <div className="p-2.5 bg-amber-500/20 rounded-lg shrink-0">
                      <Zap className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Monthly Impact
                      </p>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(parseFloat(String(report.total_annual_value)) / 12)}
                      </p>
                      <p className="text-xs text-gray-400">per month</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                    <div className="p-2.5 bg-emerald-500/20 rounded-lg shrink-0">
                      <Target className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Opportunity Areas
                      </p>
                      <p className="text-2xl font-bold text-white">
                        {(report.value_statements as ValueStatement[])?.length ?? 0}
                      </p>
                      <p className="text-xs text-gray-400">identified</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Main narrative - markdown */}
              <section className="px-8 py-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Executive Summary & Analysis
                  </h3>
                </div>
                <div className="report-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {stripDuplicateCostSection(report.summary_markdown)}
                  </ReactMarkdown>
                </div>
              </section>

              {/* Opportunity areas - enumerated sections */}
              {(report.value_statements as ValueStatement[])?.length > 0 && (
                <section className="px-8 py-8 bg-gray-800/20 border-t border-gray-700/80">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <DollarSign className="w-5 h-5 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      The Cost of Doing Nothing
                    </h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-8 max-w-2xl">
                    The following opportunity areas represent estimated annual financial impact if left unaddressed. Each is supported by industry benchmarks and evidence.
                  </p>
                  <div className="space-y-8">
                    {(report.value_statements as ValueStatement[]).map((vs, i) => {
                      const s = normalizeStatement(vs)
                      const MethodIcon = getMethodIcon(s.calculationMethod)
                      return (
                        <section
                          key={i}
                          className="relative pl-6 border-l-2 border-emerald-500/40 pb-8 last:pb-0"
                        >
                          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-gray-900" />
                          <div className="flex items-start gap-4">
                            <span className="shrink-0 text-2xl font-bold text-emerald-400/80 tabular-nums">
                              {i + 1}.
                            </span>
                            <div className="flex-1 min-w-0 space-y-4">
                              <div>
                                <h4 className="text-lg font-semibold text-white">
                                  {s.painPoint}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xl font-bold text-emerald-400">
                                    {formatCurrency(s.annualValue)}
                                  </span>
                                  <span className="text-sm text-gray-500">estimated annual impact</span>
                                </div>
                              </div>
                              <ul className="space-y-2 text-sm text-gray-300">
                                {s.formulaReadable && (
                                  <li>
                                    <span className="text-gray-500 font-medium">Calculation: </span>
                                    {s.formulaReadable}
                                  </li>
                                )}
                                {s.evidenceSummary && (
                                  <li>
                                    <span className="text-gray-500 font-medium">Basis: </span>
                                    {s.evidenceSummary}
                                  </li>
                                )}
                                {s.confidence && (
                                  <li>
                                    <span className="text-gray-500 font-medium">Confidence: </span>
                                    <span className="capitalize">{s.confidence}</span>
                                  </li>
                                )}
                              </ul>
                            </div>
                            <div className="shrink-0 p-2.5 bg-emerald-500/10 rounded-lg">
                              <MethodIcon className="w-6 h-6 text-emerald-400" />
                            </div>
                          </div>
                        </section>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Appendix A: Industry Benchmarks & Methodology */}
              <section className="px-8 py-8 border-t border-gray-700/80 bg-gray-800/30">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Appendix A: How We Arrived at These Numbers
                  </h3>
                </div>
                <div className="space-y-6">
                  <p className="text-gray-300 text-sm leading-relaxed max-w-3xl">
                    The estimated values in this report are derived using industry benchmarks, pain point evidence, and standardized calculation methods. We apply a four-tier resolution when matching benchmarks: exact industry + company size, then same industry any size, then default benchmarks for the company size, and finally general fallbacks. This ensures estimates are as relevant as possible to your business context.
                  </p>
                  {benchmarks.length > 0 ? (
                    <>
                      <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                        Benchmarks Used in This Report
                      </h4>
                      <div className="overflow-x-auto rounded-lg border border-gray-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-700 bg-gray-800/80">
                              <th className="px-4 py-3 text-left font-medium text-gray-300">Source</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-300">Type</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-300">Industry · Size</th>
                              <th className="px-4 py-3 text-right font-medium text-gray-300">Value</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-300">Year</th>
                            </tr>
                          </thead>
                          <tbody>
                            {benchmarks.map((b) => (
                              <tr key={b.id} className="border-b border-gray-700/50 last:border-0">
                                <td className="px-4 py-3">
                                  {b.source_url ? (
                                    <a
                                      href={b.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                                    >
                                      {b.source}
                                      <ExternalLink size={12} />
                                    </a>
                                  ) : (
                                    <span className="text-gray-300">{b.source}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-gray-300">
                                  {formatBenchmarkType(b.benchmark_type)}
                                </td>
                                <td className="px-4 py-3 text-gray-400">
                                  {b.industry.replace(/_/g, ' ')} · {b.company_size_range}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-400">
                                  {formatBenchmarkValue(b)}
                                </td>
                                <td className="px-4 py-3 text-gray-500">{b.year}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-500">
                        Benchmarks are sourced from BLS, Glassdoor, IBISWorld, and industry reports. Where a source URL is available, it is linked above. For more on our methodology, see our{' '}
                        <Link href="/pricing/methodology" className="text-emerald-400 hover:text-emerald-300">
                          pricing methodology
                        </Link>
                        .
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Benchmark references for this report are not available. Values were derived from industry standards and evidence-based analysis. See our{' '}
                      <Link href="/pricing/methodology" className="text-emerald-400 hover:text-emerald-300">
                        pricing methodology
                      </Link>
                      {' '}for an overview of how we calculate value.
                    </p>
                  )}
                </div>
              </section>

              {/* Footer */}
              <footer className="px-8 py-6 border-t border-gray-700/80 bg-gray-900/40">
                <p className="text-xs text-gray-500 text-center">
                  This report was prepared by Amadutown Advisory Solutions and is intended for the confidential use of the recipient. All estimates are based on industry benchmarks and available evidence at the time of analysis.
                </p>
              </footer>
            </article>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
