/**
 * Google Drive API integration for video script sync.
 * Uses service account auth. Polls scripts folder for changes and populates drive_video_queue.
 */

import { google } from 'googleapis'

const SCRIPT_EXTENSIONS = ['.txt', '.md'] as const
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

export interface DriveFileMeta {
  id: string
  name: string
  modifiedTime: string
  lastModifyingUser?: { displayName?: string; emailAddress?: string }
}

export interface DriveScriptChange {
  driveFileId: string
  driveFileName: string
  scriptText: string
  scriptTextPrior: string | null
  effectiveAt: string
}

function getDriveClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured')
  }
  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(keyJson) as Record<string, unknown>
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is invalid JSON')
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: DRIVE_SCOPES,
  })
  return google.drive({ version: 'v3', auth })
}

function hasScriptExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return SCRIPT_EXTENSIONS.some(ext => lower.endsWith(ext))
}

/**
 * List files in folder modified after the given RFC3339 timestamp.
 */
export async function listChangedScripts(
  folderId: string,
  modifiedAfter: string
): Promise<DriveFileMeta[]> {
  const drive = getDriveClient()
  const res = await drive.files.list({
    q: `'${folderId}' in parents and modifiedTime > '${modifiedAfter}' and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, lastModifyingUser)',
    orderBy: 'modifiedTime desc',
  })
  const files = (res.data.files ?? []) as Array<{
    id?: string
    name?: string
    mimeType?: string
    modifiedTime?: string
    lastModifyingUser?: { displayName?: string; emailAddress?: string }
  }>
  return files
    .filter(f => f.id && f.name && hasScriptExtension(f.name))
    .map(f => ({
      id: f.id!,
      name: f.name!,
      modifiedTime: f.modifiedTime ?? '',
      lastModifyingUser: f.lastModifyingUser,
    }))
}

/**
 * Download file content as text. Supports .txt and .md.
 */
export async function downloadFileContent(fileId: string): Promise<string> {
  const drive = getDriveClient()
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'text' }
  )
  const data = res.data
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf-8')
  return String(data ?? '')
}

/**
 * Get previous revision content for diff. Returns null if no prior revision.
 */
export async function getPreviousRevisionContent(fileId: string): Promise<string | null> {
  const drive = getDriveClient()
  const listRes = await drive.revisions.list({
    fileId,
    fields: 'revisions(id, modifiedTime)',
    pageSize: 10,
  })
  const revisions = (listRes.data.revisions ?? []) as Array<{ id?: string; modifiedTime?: string }>
  if (revisions.length < 2) return null
  const prevRevision = revisions[1]
  if (!prevRevision?.id) return null
  try {
    const getRes = await drive.revisions.get(
      { fileId, revisionId: prevRevision.id, alt: 'media' },
      { responseType: 'text' }
    )
    const data = getRes.data
    if (typeof data === 'string') return data
    if (Buffer.isBuffer(data)) return data.toString('utf-8')
    return data ? String(data) : null
  } catch {
    return null
  }
}

/**
 * Fetch a single changed script: current content + prior (if modified).
 */
export async function fetchScriptChange(file: DriveFileMeta): Promise<DriveScriptChange> {
  const scriptText = await downloadFileContent(file.id)
  let scriptTextPrior: string | null = null
  try {
    scriptTextPrior = await getPreviousRevisionContent(file.id)
  } catch {
    // Ignore; prior stays null
  }
  return {
    driveFileId: file.id,
    driveFileName: file.name,
    scriptText,
    scriptTextPrior,
    effectiveAt: file.modifiedTime,
  }
}
