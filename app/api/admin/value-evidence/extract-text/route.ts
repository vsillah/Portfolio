import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_EXTRACTED_CHARS = 50_000 // truncate very large documents

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'text',
  'text/csv': 'text',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    const fileType = SUPPORTED_MIME_TYPES[file.type]
    if (!fileType && !file.type.startsWith('image/')) {
      return NextResponse.json(
        {
          error: 'Unsupported file type. Supported: PDF, DOCX, plain text, CSV, images.',
        },
        { status: 400 }
      )
    }

    const resolvedType = fileType || 'image'
    const buffer = Buffer.from(await file.arrayBuffer())
    let text = ''
    let pages: number | undefined

    switch (resolvedType) {
      case 'pdf': {
        const pdfParse = (await import('pdf-parse')).default
        const pdfData = await pdfParse(buffer)
        text = pdfData.text
        pages = pdfData.numpages
        break
      }
      case 'docx': {
        const mod = await import('mammoth')
        const mammoth = mod.default || mod
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
        break
      }
      case 'text': {
        text = buffer.toString('utf-8')
        break
      }
      case 'image': {
        text = `[Image uploaded: ${file.name}]`
        break
      }
    }

    if (text.length > MAX_EXTRACTED_CHARS) {
      text = text.slice(0, MAX_EXTRACTED_CHARS) + '\n\n[… truncated — document exceeded extraction limit]'
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length

    return NextResponse.json({
      text,
      metadata: {
        filename: file.name,
        mimeType: file.type,
        pages,
        wordCount,
      },
    })
  } catch (err) {
    console.error('Text extraction error:', err)
    return NextResponse.json(
      { error: 'Failed to extract text from file' },
      { status: 500 }
    )
  }
}
