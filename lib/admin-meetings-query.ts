export type MatchEmailBranchArgs = {
  matchEmail: string
  contactIdParam: string | null
  unlinkedOnly: boolean
  attributedOnly: boolean
  q: string
}

export function shouldUseMatchEmailBranch(args: MatchEmailBranchArgs): boolean {
  return (
    args.matchEmail.length > 0 &&
    args.contactIdParam === null &&
    !args.unlinkedOnly &&
    !args.attributedOnly &&
    !args.q
  )
}

export function toEmailLikePattern(email: string): string {
  const escaped = email
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
  return `%${escaped}%`
}
