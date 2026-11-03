import { notFound } from 'next/navigation'
import { L01Review } from './review'

export default function Page({ params, searchParams }: { params: { slug: string }; searchParams?: { t?: string; rev?: string } }) {
  if (params.slug !== 'accelerated-cohort') notFound()
  const requestedTime = Number(searchParams?.t ?? 0)
  const initialSeconds = Number.isFinite(requestedTime) ? Math.max(0, Math.min(540, requestedTime)) : 0
  return <L01Review initialSeconds={initialSeconds} revision={searchParams?.rev ?? ''} />
}
