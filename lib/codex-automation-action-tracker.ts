import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, rename, writeFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

export type AutomationActionStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'dismissed'
export type AutomationActionKind = 'blocker_or_approval' | 'next_run_focus'
export type AutomationActionPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface AutomationActionUpdate {
  status?: AutomationActionStatus
  owner?: string | null
  note?: string | null
  linkedWorkItemId?: string | null
}

export interface AutomationActionItem {
  id: string
  automationId: string
  automationName: string
  statusColor: 'green' | 'yellow' | 'red' | 'unknown'
  headline: string
  summary: string
  kind: AutomationActionKind
  text: string
  priority: AutomationActionPriority
  actionStatus: AutomationActionStatus
  owner: string | null
  note: string | null
  linkedWorkItemId: string | null
  firstSeenAt: string
  lastSeenAt: string
  occurrenceCount: number
  sourceFiles: string[]
  latestSourceFile: string
  codexThreadHint: string | null
}

export interface AutomationActionTracker {
  available: boolean
  reason?: string
  generatedAt: string
  sourceDirectory: string
  stateFile: string
  actions: AutomationActionItem[]
  recentNotifications: AutomationNotificationSummary[]
  summary: {
    total: number
    open: number
    inProgress: number
    blocked: number
    done: number
    dismissed: number
    urgent: number
    high: number
  }
  automationFeedback: AutomationActionFeedback[]
}

export interface AutomationNotificationSummary {
  automationId: string
  automationName: string
  ranAtUtc: string
  status: string
  headline: string
  sourceFile: string
  actionCount: number
}

export interface AutomationActionFeedback {
  automationId: string
  automationName: string
  openActions: number
  inProgressActions: number
  blockedActions: number
  doneActions: number
  lastProgressAt: string | null
  progressNotes: string[]
}

type NotificationPayload = {
  automation_id?: string
  automation_name?: string
  ran_at_utc?: string
  status?: string
  headline?: string
  summary?: string
  blockers_or_approvals?: unknown
  next_run_focus?: unknown
  codex_thread_hint?: string
}

type ActionState = {
  status?: AutomationActionStatus
  owner?: string | null
  note?: string | null
  linkedWorkItemId?: string | null
  updatedAt?: string
}

type TrackerState = {
  version: 1
  updatedAt: string
  actions: Record<string, ActionState>
}

type RawAction = {
  id: string
  automationId: string
  automationName: string
  statusColor: AutomationActionItem['statusColor']
  headline: string
  summary: string
  kind: AutomationActionKind
  text: string
  priority: AutomationActionPriority
  seenAt: string
  sourceFile: string
  codexThreadHint: string | null
}

const DEFAULT_NOTIFICATIONS_DIR = path.join(homedir(), '.codex', 'automation-notifications')
const STATE_FILENAME = 'action-tracker.json'
const FEEDBACK_FILENAME = 'automation-action-feedback.json'
const MAX_SENT_DAYS = 14
const MAX_NOTIFICATION_FILES = 200

export function getDefaultAutomationNotificationsDir() {
  return process.env.CODEX_AUTOMATION_NOTIFICATIONS_DIR || DEFAULT_NOTIFICATIONS_DIR
}

export async function listAutomationActionTracker(
  notificationsRoot = getDefaultAutomationNotificationsDir(),
): Promise<AutomationActionTracker> {
  const generatedAt = new Date().toISOString()
  const stateFile = path.join(notificationsRoot, STATE_FILENAME)

  if (!existsSync(notificationsRoot)) {
    return unavailableTracker(notificationsRoot, stateFile, generatedAt, 'Local automation notification directory is not available')
  }

  try {
    const [state, notifications] = await Promise.all([
      readTrackerState(stateFile),
      readNotificationPayloads(notificationsRoot),
    ])
    const actions = buildActions(notifications.flatMap((notification) => notification.actions), state)
    const tracker: AutomationActionTracker = {
      available: true,
      generatedAt,
      sourceDirectory: notificationsRoot,
      stateFile,
      actions,
      recentNotifications: notifications.map((notification) => notification.summary),
      summary: summarizeActions(actions),
      automationFeedback: buildAutomationFeedback(actions),
    }
    await writeFeedbackFile(notificationsRoot, tracker.automationFeedback)
    return tracker
  } catch (error) {
    return unavailableTracker(
      notificationsRoot,
      stateFile,
      generatedAt,
      error instanceof Error ? error.message : 'Failed to read automation action tracker',
    )
  }
}

export async function updateAutomationActionState(
  actionId: string,
  update: AutomationActionUpdate,
  notificationsRoot = getDefaultAutomationNotificationsDir(),
) {
  const stateFile = path.join(notificationsRoot, STATE_FILENAME)
  const state = await readTrackerState(stateFile)
  const current = state.actions[actionId] ?? {}
  state.actions[actionId] = {
    ...current,
    ...normalizeUpdate(update),
    updatedAt: new Date().toISOString(),
  }
  state.updatedAt = state.actions[actionId].updatedAt!
  await writeTrackerState(stateFile, state)
  return state.actions[actionId]
}

function unavailableTracker(sourceDirectory: string, stateFile: string, generatedAt: string, reason: string): AutomationActionTracker {
  return {
    available: false,
    reason,
    generatedAt,
    sourceDirectory,
    stateFile,
    actions: [],
    recentNotifications: [],
    summary: {
      total: 0,
      open: 0,
      inProgress: 0,
      blocked: 0,
      done: 0,
      dismissed: 0,
      urgent: 0,
      high: 0,
    },
    automationFeedback: [],
  }
}

async function readNotificationPayloads(notificationsRoot: string) {
  const files = await findNotificationFiles(notificationsRoot)
  const notifications: Array<{ summary: AutomationNotificationSummary; actions: RawAction[] }> = []

  for (const file of files) {
    const payload = await readJsonFile<NotificationPayload>(file)
    if (!payload) continue
    const automationId = clean(payload.automation_id) || slugFromFile(file)
    const automationName = clean(payload.automation_name) || automationId
    const ranAtUtc = clean(payload.ran_at_utc) || timestampFromFile(file) || new Date(0).toISOString()
    const statusColor = normalizeStatusColor(payload.status)
    const base = {
      automationId,
      automationName,
      statusColor,
      headline: clean(payload.headline) || 'Automation report',
      summary: clean(payload.summary) || '',
      seenAt: ranAtUtc,
      sourceFile: file,
      codexThreadHint: clean(payload.codex_thread_hint),
    }
    const actions: RawAction[] = [
      ...stringArray(payload.blockers_or_approvals).map((text) => buildRawAction(base, 'blocker_or_approval', text)),
      ...stringArray(payload.next_run_focus).map((text) => buildRawAction(base, 'next_run_focus', text)),
    ]
    notifications.push({
      summary: {
        automationId,
        automationName,
        ranAtUtc,
        status: statusColor,
        headline: base.headline,
        sourceFile: file,
        actionCount: actions.length,
      },
      actions,
    })
  }

  return notifications.sort((a, b) => b.summary.ranAtUtc.localeCompare(a.summary.ranAtUtc))
}

async function findNotificationFiles(notificationsRoot: string) {
  const files: string[] = []
  const pendingDir = path.join(notificationsRoot, 'pending')
  if (existsSync(pendingDir)) {
    files.push(...await jsonFilesInDirectory(pendingDir))
  }

  const sentDir = path.join(notificationsRoot, 'sent')
  if (existsSync(sentDir)) {
    const days = (await readdir(sentDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .slice(-MAX_SENT_DAYS)
    for (const day of days) {
      files.push(...await jsonFilesInDirectory(path.join(sentDir, day)))
    }
  }

  return files
    .sort((a, b) => b.localeCompare(a))
    .slice(0, MAX_NOTIFICATION_FILES)
}

async function jsonFilesInDirectory(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(directory, entry.name))
}

function buildRawAction(
  base: Omit<RawAction, 'id' | 'kind' | 'text' | 'priority'>,
  kind: AutomationActionKind,
  text: string,
): RawAction {
  const normalized = normalizeText(text)
  const id = `${base.automationId}:${kind}:${hash(normalized)}`
  return {
    ...base,
    id,
    kind,
    text,
    priority: classifyPriority(kind, base.statusColor, text),
  }
}

function buildActions(rawActions: RawAction[], state: TrackerState): AutomationActionItem[] {
  const grouped = new Map<string, RawAction[]>()
  for (const action of rawActions) {
    grouped.set(action.id, [...(grouped.get(action.id) ?? []), action])
  }

  return Array.from(grouped.entries())
    .map(([id, occurrences]) => {
      const sorted = occurrences.sort((a, b) => a.seenAt.localeCompare(b.seenAt))
      const first = sorted[0]
      const latest = sorted[sorted.length - 1]
      const actionState = state.actions[id] ?? {}
      return {
        id,
        automationId: latest.automationId,
        automationName: latest.automationName,
        statusColor: latest.statusColor,
        headline: latest.headline,
        summary: latest.summary,
        kind: latest.kind,
        text: latest.text,
        priority: latest.priority,
        actionStatus: actionState.status ?? 'open',
        owner: actionState.owner ?? null,
        note: actionState.note ?? null,
        linkedWorkItemId: actionState.linkedWorkItemId ?? null,
        firstSeenAt: first.seenAt,
        lastSeenAt: latest.seenAt,
        occurrenceCount: sorted.length,
        sourceFiles: Array.from(new Set(sorted.map((action) => action.sourceFile))),
        latestSourceFile: latest.sourceFile,
        codexThreadHint: latest.codexThreadHint,
      }
    })
    .sort((a, b) => {
      const statusRank: Record<AutomationActionStatus, number> = { blocked: 0, open: 1, in_progress: 2, done: 3, dismissed: 4 }
      const priorityRank: Record<AutomationActionPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
      return statusRank[a.actionStatus] - statusRank[b.actionStatus]
        || priorityRank[a.priority] - priorityRank[b.priority]
        || b.lastSeenAt.localeCompare(a.lastSeenAt)
    })
}

function buildAutomationFeedback(actions: AutomationActionItem[]): AutomationActionFeedback[] {
  const byAutomation = new Map<string, AutomationActionItem[]>()
  for (const action of actions) {
    byAutomation.set(action.automationId, [...(byAutomation.get(action.automationId) ?? []), action])
  }

  return Array.from(byAutomation.entries())
    .map(([automationId, automationActions]) => {
      const latestAction = automationActions
        .filter((action) => action.note)
        .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))[0]
      return {
        automationId,
        automationName: automationActions[0]?.automationName ?? automationId,
        openActions: automationActions.filter((action) => action.actionStatus === 'open').length,
        inProgressActions: automationActions.filter((action) => action.actionStatus === 'in_progress').length,
        blockedActions: automationActions.filter((action) => action.actionStatus === 'blocked').length,
        doneActions: automationActions.filter((action) => action.actionStatus === 'done').length,
        lastProgressAt: latestAction?.lastSeenAt ?? null,
        progressNotes: automationActions
          .filter((action) => action.note)
          .slice(0, 5)
          .map((action) => `${action.text}: ${action.note}`),
      }
    })
    .sort((a, b) => (b.blockedActions + b.openActions) - (a.blockedActions + a.openActions))
}

function summarizeActions(actions: AutomationActionItem[]): AutomationActionTracker['summary'] {
  return {
    total: actions.length,
    open: actions.filter((action) => action.actionStatus === 'open').length,
    inProgress: actions.filter((action) => action.actionStatus === 'in_progress').length,
    blocked: actions.filter((action) => action.actionStatus === 'blocked').length,
    done: actions.filter((action) => action.actionStatus === 'done').length,
    dismissed: actions.filter((action) => action.actionStatus === 'dismissed').length,
    urgent: actions.filter((action) => action.priority === 'urgent').length,
    high: actions.filter((action) => action.priority === 'high').length,
  }
}

async function readTrackerState(stateFile: string): Promise<TrackerState> {
  const state = await readJsonFile<TrackerState>(stateFile)
  if (!state || state.version !== 1 || typeof state.actions !== 'object' || !state.actions) {
    return { version: 1, updatedAt: new Date(0).toISOString(), actions: {} }
  }
  return state
}

async function writeTrackerState(stateFile: string, state: TrackerState) {
  await mkdir(path.dirname(stateFile), { recursive: true })
  const tmpFile = `${stateFile}.${process.pid}.tmp`
  await writeFile(tmpFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  await rename(tmpFile, stateFile)
}

async function writeFeedbackFile(notificationsRoot: string, feedback: AutomationActionFeedback[]) {
  const file = path.join(notificationsRoot, FEEDBACK_FILENAME)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify({ generatedAt: new Date().toISOString(), feedback }, null, 2)}\n`, 'utf8')
}

async function readJsonFile<T>(file: string): Promise<T | null> {
  if (!existsSync(file)) return null
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return null
  }
}

function normalizeUpdate(update: AutomationActionUpdate): ActionState {
  const normalized: ActionState = {}
  if (update.status) normalized.status = update.status
  if (update.owner !== undefined) normalized.owner = clean(update.owner)
  if (update.note !== undefined) normalized.note = clean(update.note)
  if (update.linkedWorkItemId !== undefined) normalized.linkedWorkItemId = clean(update.linkedWorkItemId)
  return normalized
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => clean(item)).filter((item): item is string => Boolean(item)) : []
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() || null : null
}

function normalizeStatusColor(status: unknown): AutomationActionItem['statusColor'] {
  const value = typeof status === 'string' ? status.toLowerCase() : ''
  if (value === 'green' || value === 'yellow' || value === 'red') return value
  return 'unknown'
}

function classifyPriority(kind: AutomationActionKind, statusColor: AutomationActionItem['statusColor'], text: string): AutomationActionPriority {
  const normalized = text.toLowerCase()
  if (statusColor === 'red' || normalized.includes('approval') || normalized.includes('blocked') || normalized.includes('fails')) return 'urgent'
  if (kind === 'blocker_or_approval' || statusColor === 'yellow') return 'high'
  if (normalized.includes('verify') || normalized.includes('confirm') || normalized.includes('refresh')) return 'medium'
  return 'low'
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function hash(value: string) {
  return createHash('sha1').update(value).digest('hex').slice(0, 12)
}

function timestampFromFile(file: string) {
  return path.basename(file).match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)/)?.[1]?.replace(/T(\d{2})-(\d{2})-(\d{2})Z/, 'T$1:$2:$3Z') ?? null
}

function slugFromFile(file: string) {
  return path.basename(file).replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z--/, '').replace(/\.json$/, '')
}
