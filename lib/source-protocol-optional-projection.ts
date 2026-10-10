import {
  buildEvidenceQaApprovalPlanFromFiles,
  type EvidenceQaApprovalPlan,
} from './banned-books-evidence-qa'

export type OptionalEvidenceQaUnavailable = {
  code: 'optional_projection_file_missing' | 'optional_projection_unavailable'
  message: string
  sourceImportPath: string
  approvalPath: string
}

export function buildOptionalEvidenceQaProjection(
  sourceImportPath: string,
  approvalPath: string,
  builder: (sourcePath: string, decisionsPath: string) => EvidenceQaApprovalPlan = buildEvidenceQaApprovalPlanFromFiles
): {
  data: EvidenceQaApprovalPlan | null
  unavailable: OptionalEvidenceQaUnavailable | null
} {
  try {
    return {
      data: builder(sourceImportPath, approvalPath),
      unavailable: null,
    }
  } catch (error: unknown) {
    const errorCode = typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : ''
    const missingFile = errorCode === 'ENOENT'

    return {
      data: null,
      unavailable: {
        code: missingFile ? 'optional_projection_file_missing' : 'optional_projection_unavailable',
        message: missingFile
          ? 'Evidence QA approval projection is unavailable because its optional local fixture files were not packaged for this deployment.'
          : 'Evidence QA approval projection could not be generated from its optional local fixture files.',
        sourceImportPath,
        approvalPath,
      },
    }
  }
}
