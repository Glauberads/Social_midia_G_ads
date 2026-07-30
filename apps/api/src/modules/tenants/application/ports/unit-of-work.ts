export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface UnitOfWork {
  execute<T>(work: (tx: any) => Promise<T>): Promise<T>;
}
