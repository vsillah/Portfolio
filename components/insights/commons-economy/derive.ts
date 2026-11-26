import type { AltitudeId, Edge, EconomyModel, EconomyNode, LabelMode, LabelPair, LayerId, View } from './adapter'

/*
 * Pure selectors over a validated envelope. They apply the producer's
 * documented display rules (`nodeVisible`, `edgeVisible`, `captionsAt`) to the
 * injected model and return the model's own objects; they never author or
 * rewrite a value. Layout grouping below is presentation only.
 */

export const labelOf = (pair: LabelPair, mode: LabelMode) => pair[mode]

export function initialView(model: EconomyModel): View {
  const view = model.defaultView
  return { ...view, layers: { ...view.layers } }
}

export const nodeById = (model: EconomyModel, id: string) => model.nodes.find(item => item.id === id)
export const nodeVisible = (item: EconomyNode, view: View) => item.layers.some(id => view.layers[id])
export const visibleNodes = (model: EconomyModel, view: View) => model.nodes.filter(item => nodeVisible(item, view))
export function edgeVisible(model: EconomyModel, item: Edge, view: View) {
  const from = nodeById(model, item.from)
  const to = nodeById(model, item.to)
  return view.layers[item.flow] && item.layers.some(id => view.layers[id]) && !!from && !!to && nodeVisible(from, view) && nodeVisible(to, view)
}
export const visibleEdges = (model: EconomyModel, view: View) => model.edges.filter(item => edgeVisible(model, item, view))

const rank = (model: EconomyModel, id: AltitudeId) => model.altitudes.find(item => item.id === id)!.rank
/* A caption prints only at its own altitude or closer to the door. */
export const captionsAt = (model: EconomyModel, id: string, altitude: AltitudeId) =>
  (nodeById(model, id)?.captions ?? []).filter(item => rank(model, item.detail) <= rank(model, altitude))

export const touching = (edges: Edge[], id: string) => edges.filter(item => item.from === id || item.to === id)
export const historicalLineOf = (model: EconomyModel, id: string) => model.historicalLines.find(item => item.node === id) ?? null
export const joinOf = (model: EconomyModel, id: string) => model.joins.find(item => item.id === id)!
export const flowOf = (model: EconomyModel, id: string) => model.flows.find(item => item.id === id)!
export const layersOfKind = (model: EconomyModel, kind: 'model' | 'flow') => model.layers.filter(item => item.kind === kind)

/* The node a selection can open: visible and pressable. */
export function openNode(model: EconomyModel, view: View, selected: string | null) {
  if (!selected) return null
  const item = nodeById(model, selected)
  return item && nodeVisible(item, view) && item.interactive !== false ? item : null
}

/* A walk prints along its own flow, so following one turns that flow on. */
export const withLayer = (view: View, id: LayerId): View => (view.layers[id] ? view : { ...view, layers: { ...view.layers, [id]: true } })

/* Presentation grouping only: groups with their members, the centre, the rest, and the designs printed for comparison. */
export function arrange(nodes: EconomyNode[]) {
  const groups = nodes.filter(item => item.kind === 'group').map(group => ({ group, members: nodes.filter(item => item.parent === group.id) }))
  const grouped = new Set(groups.flatMap(entry => [entry.group.id, ...entry.members.map(item => item.id)]))
  const centre = nodes.filter(item => item.kind === 'centre' && !grouped.has(item.id))
  const tried = nodes.filter(item => item.historical && !grouped.has(item.id))
  /* A member whose group is hidden falls into the rest and still prints. */
  const rest = nodes.filter(item => !grouped.has(item.id) && !centre.includes(item) && !tried.includes(item))
  return { groups, centre, rest, tried }
}
