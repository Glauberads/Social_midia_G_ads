import { Injectable } from '@nestjs/common';
import { Prisma } from '@projeto/database';
import { ContentScheduleRepository, CreateContentScheduleInput, UpdateContentScheduleInput } from '../../domain/repositories/content-schedule.repository';
import { ContentScheduleModel, ScheduleStatus } from '../../domain/models/content-schedule.model';

@Injectable()
export class PrismaContentScheduleRepository implements ContentScheduleRepository {
  private mapToModel(data: any): ContentScheduleModel {
    return new ContentScheduleModel(
      data.id,
      data.tenantId,
      data.contentRequestId,
      data.revisionId,
      data.scheduledById,
      data.status as ScheduleStatus,
      data.scheduledFor,
      data.scheduledMinute,
      data.timezone,
      data.canceledAt,
      data.canceledById,
      data.cancelReason,
      data.createdAt,
      data.updatedAt,
    );
  }

  async create(data: CreateContentScheduleInput, tx: Prisma.TransactionClient): Promise<ContentScheduleModel> {
    const created = await tx.contentSchedule.create({
      data: {
        tenantId: data.tenantId,
        contentRequestId: data.contentRequestId,
        revisionId: data.revisionId,
        scheduledById: data.scheduledById,
        status: data.status,
        scheduledFor: data.scheduledFor,
        scheduledMinute: data.scheduledMinute,
        timezone: data.timezone,
      },
    });
    return this.mapToModel(created);
  }

  async findById(id: string, tenantId: string, tx: Prisma.TransactionClient): Promise<ContentScheduleModel | null> {
    const found = await tx.contentSchedule.findFirst({
      where: {
        id,
        tenantId,
      },
    });
    return found ? this.mapToModel(found) : null;
  }

  async findActiveByContentRequestId(contentRequestId: string, tenantId: string, tx: Prisma.TransactionClient): Promise<ContentScheduleModel | null> {
    const found = await tx.contentSchedule.findFirst({
      where: {
        contentRequestId,
        tenantId,
        status: {
          in: ['SCHEDULED', 'DUE']
        }
      },
    });
    return found ? this.mapToModel(found) : null;
  }

  async findMany(tenantId: string, startDate: Date, endDate: Date, tx: Prisma.TransactionClient): Promise<ContentScheduleModel[]> {
    const records = await tx.contentSchedule.findMany({
      where: {
        tenantId,
        scheduledFor: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });
    return records.map(this.mapToModel.bind(this));
  }

  async update(id: string, tenantId: string, data: UpdateContentScheduleInput, tx: Prisma.TransactionClient): Promise<ContentScheduleModel> {
    const updated = await tx.contentSchedule.update({
      where: {
        id,
        tenantId,
      },
      data: {
        ...data
      },
    });
    return this.mapToModel(updated);
  }
}
