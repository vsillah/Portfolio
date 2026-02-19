import { readFile } from 'fs/promises'
import path from 'path'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import DocViewer from '@/components/admin/DocViewer'

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
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs
            items={[
              { label: 'Admin Dashboard', href: '/admin' },
              { label: 'Help' },
            ]}
          />
          <div className="prose prose-invert max-w-none">
            <DocViewer content={content} />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
