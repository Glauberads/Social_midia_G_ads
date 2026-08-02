export function shouldPollGeneration(status: string): boolean {
  return status === 'SUBMITTED' || status === 'GENERATING';
}

export function canSubmitGeneration(status: string): boolean {
  return status === 'DRAFT' || status === 'REJECTED' || status === 'FAILED';
}

export function generationEndpoint(id: string, status: string): string {
  return status === 'FAILED' ? `/content-requests/${id}/retry` : `/content-requests/${id}/submit`;
}
