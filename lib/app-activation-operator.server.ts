import 'server-only'

// The only application-layer entrypoint used by the authenticated route.
// This phase has no hosted repository or service-role client.
export { applySyntheticOperatorAction, getOperatorSnapshot, OperatorActionError } from './app-activation-operator'
export type { OperatorAction } from './app-activation-operator'
