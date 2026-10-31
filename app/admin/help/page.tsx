import { readFile } from 'fs/promises'
import path from 'path'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import DocViewer from '@/components/admin/DocViewer'
import Link from 'next/link'

const DOC_PATH = path.join(process.cwd(), 'docs', 'admin-sales-lead-pipeline-sop.md')

export default async function AdminHelpPage() {
  let content: string
  try {
    content = await readFile(DOC_PATH, 'utf-8')
  } catch {
    content = '# Help\n\nDocument could not be loaded. Ensure `docs/admin-sales-lead-pipeline-sop.md` exists.'
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs
            items={[
              { label: 'Admin Dashboard', href: '/admin' },
              { label: 'Help' },
            ]}
          />
          <Link href="/admin/help/onboarding" className="my-6 block rounded-2xl border border-radiant-gold/30 bg-radiant-gold/5 p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-radiant-gold">
            <span className="block text-lg font-semibold text-radiant-gold">New to AmaduTown? Start here →</span>
            <span className="mt-2 block text-sm text-muted-foreground">Meet Portfolio, learn the tools, and walk through your first week.</span>
          </Link>
          <div className="prose prose-invert max-w-none">
            <DocViewer content={content} />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
