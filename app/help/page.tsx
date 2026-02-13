import { readFile } from 'fs/promises'
import path from 'path'
import Breadcrumbs from '@/components/Breadcrumbs'
import DocViewer from '@/components/DocViewer'

const DOC_PATH = path.join(process.cwd(), 'docs', 'user-help-guide.md')

export default async function HelpPage() {
  let content: string
  try {
    content = await readFile(DOC_PATH, 'utf-8')
  } catch {
    content = '# Help\n\nDocument could not be loaded. Ensure `docs/user-help-guide.md` exists.'
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Help' },
          ]}
        />
        <div className="prose prose-invert max-w-none">
          <DocViewer content={content} />
        </div>
      </div>
    </div>
  )
}
