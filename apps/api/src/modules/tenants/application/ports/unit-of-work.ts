export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface UnitOfWork {
  executeGlobal<T>(userId: string | null, work: (tx: any) => Promise<T>): Promise<T>;
  executeWithTenant<T>(tenantId: string, userId: string, work: (tx: any) => Promise<T>): Promise<T>;
}
