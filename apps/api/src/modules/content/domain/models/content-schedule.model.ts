export enum ScheduleStatus {
  SCHEDULED = 'SCHEDULED',
  CANCELED = 'CANCELED',
  DUE = 'DUE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class ContentScheduleModel {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly contentRequestId: string,
    public readonly revisionId: string,
    public readonly scheduledById: string,
    public readonly status: ScheduleStatus,
    public readonly scheduledFor: Date,
    public readonly scheduledMinute: Date,
    public readonly timezone: string,
    public readonly canceledAt: Date | null,
    public readonly canceledById: string | null,
    public readonly cancelReason: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
