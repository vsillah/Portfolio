import { put } from '@vercel/blob'
import { promises as fs } from 'fs'
import path from 'path'

type UploadPlanItem = {
  localPath: string
  pathname: string
  contentType: string
  sizeBytes: number
}

const REPO_ROOT = process.cwd()
const AVATAR_ROOT = path.join(REPO_ROOT, 'public', 'agent-avatars')
const DEFAULT_EXTENSIONS = new Set(['.png', '.svg'])

function hasFlag(flag: string) {
  return process.argv.includes(flag)
}

function getContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.png') return 'image/png'
  if (extension === '.svg') return 'image/svg+xml'

  return 'application/octet-stream'
}

async function collectAvatarAssets(directory: string): Promise<UploadPlanItem[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const items = await Promise.all(
    entries.map(async (entry) => {
      const localPath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        return collectAvatarAssets(localPath)
      }

      if (!entry.isFile() || !DEFAULT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        return []
      }

      const stats = await fs.stat(localPath)
      const pathname = path
        .relative(path.join(REPO_ROOT, 'public'), localPath)
        .split(path.sep)
        .join('/')

      return [
        {
          localPath,
          pathname,
          contentType: getContentType(localPath),
          sizeBytes: stats.size,
        },
      ]
    }),
  )

  return items.flat().sort((a, b) => a.pathname.localeCompare(b.pathname))
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

async function main() {
  const write = hasFlag('--write')
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const plan = await collectAvatarAssets(AVATAR_ROOT)

  if (write && !token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required when running with --write.')
  }

  console.log(`Agent avatar Blob seed ${write ? 'write' : 'dry run'}`)
  console.log(`Assets: ${plan.length}`)

  const uploadedUrls: string[] = []

  for (const item of plan) {
    const summary = `${item.pathname} (${item.contentType}, ${formatBytes(item.sizeBytes)})`

    if (!write) {
      console.log(`DRY RUN  ${summary}`)
      continue
    }

    const file = await fs.readFile(item.localPath)
    const result = await put(item.pathname, file, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: item.contentType,
      token,
    })

    uploadedUrls.push(result.url)
    console.log(`UPLOADED ${summary} -> ${result.url}`)
  }

  if (!write) {
    console.log('')
    console.log('No storage writes were performed. Re-run with --write after confirming the target Blob store.')
    console.log('Example: BLOB_READ_WRITE_TOKEN=... npm run agent-avatars:seed-blob -- --write')
    return
  }

  const firstUrl = uploadedUrls[0]
  if (firstUrl) {
    const firstPath = plan[0]?.pathname
    const baseUrl = firstPath && firstUrl.endsWith(firstPath) ? firstUrl.slice(0, -firstPath.length).replace(/\/$/, '') : null

    console.log('')
    if (baseUrl) {
      console.log(`Set NEXT_PUBLIC_AGENT_AVATAR_ASSET_BASE_URL=${baseUrl}`)
    } else {
      console.log('Uploaded URLs did not share the expected pathname suffix. Do not set the base URL without manual review.')
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
