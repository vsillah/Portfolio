import { notFound } from 'next/navigation'
import { L01Review } from './review'

export default function Page({ params }: { params: { slug: string } }) {
  if (params.slug !== 'accelerated-cohort') notFound()
  return <L01Review />
}
