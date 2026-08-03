import { Prisma } from '@projeto/database';
import { ContentScheduleModel, ScheduleStatus } from '../models/content-schedule.model';

export interface CreateContentScheduleInput {
  tenantId: string;
  contentRequestId: string;
  revisionId: string;
  scheduledById: string;
  status: ScheduleStatus;
  scheduledFor: Date;
  scheduledMinute: Date;
  timezone: string;
}

export interface UpdateContentScheduleInput {
  status?: ScheduleStatus;
  scheduledFor?: Date;
  scheduledMinute?: Date;
  timezone?: string;
  canceledAt?: Date;
  canceledById?: string;
  cancelReason?: string | null;
}

export abstract class ContentScheduleRepository {
  abstract create(data: CreateContentScheduleInput, tx: Prisma.TransactionClient): Promise<ContentScheduleModel>;
  abstract findById(id: string, tenantId: string, tx: Prisma.TransactionClient): Promise<ContentScheduleModel | null>;
  abstract findActiveByContentRequestId(contentRequestId: string, tenantId: string, tx: Prisma.TransactionClient): Promise<ContentScheduleModel | null>;
  abstract findMany(tenantId: string, startDate: Date, endDate: Date, tx: Prisma.TransactionClient): Promise<ContentScheduleModel[]>;
  abstract update(id: string, tenantId: string, data: UpdateContentScheduleInput, tx: Prisma.TransactionClient): Promise<ContentScheduleModel>;
}
