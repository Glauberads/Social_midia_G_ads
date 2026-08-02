export interface EditorialRevisionState {
  status: string;
  version: number;
}

export function activeEditorialRevision<T extends EditorialRevisionState>(items: T[]): T | null {
  return items.find((item) => item.status === 'DRAFT') ?? items[0] ?? null;
}

export function canEditEditorial(contentStatus: string): boolean {
  return contentStatus === 'READY' || contentStatus === 'REJECTED';
}

export function canDecideEditorial(contentStatus: string, revisionStatus?: string): boolean {
  return contentStatus === 'READY' && revisionStatus === 'DRAFT';
}
