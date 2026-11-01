import { notFound } from 'next/navigation'
import LinkedInFixture from './preview'

export default function LinkedInHandoffFixturePage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <LinkedInFixture />
}
