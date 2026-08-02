import { Injectable } from '@nestjs/common';
import { ContentRequestRepository, CreateContentRequestInput, UpdateContentRequestInput } from '../../domain/repositories/content-request.repository';
import { ContentRequestModel, ContentStatus, ContentPlatform } from '../../domain/models/content-request.model';
import { Prisma } from '@projeto/database';

@Injectable()
export class PrismaContentRequestRepository implements ContentRequestRepository {

  private mapToDomain(raw: any): ContentRequestModel {
    return new ContentRequestModel(
      raw.id,
      raw.tenantId,
      raw.createdById,
      raw.title,
      raw.briefing,
      raw.objective,
      raw.audience,
      raw.tone,
      raw.platform as ContentPlatform,
      raw.status as ContentStatus,
      raw.createdAt,
      raw.updatedAt,
    );
  }

  async create(data: CreateContentRequestInput, tx: Prisma.TransactionClient): Promise<ContentRequestModel> {
    const created = await tx.contentRequest.create({
      data: {
        title: data.title,
        briefing: data.briefing,
        objective: data.objective,
        audience: data.audience,
        tone: data.tone,
        platform: data.platform as any,
        status: data.status as any,
        tenantId: data.tenantId,
        createdById: data.createdById,
      },
    });
    return this.mapToDomain(created);
  }

  async findById(id: string, tenantId: string, tx: Prisma.TransactionClient): Promise<ContentRequestModel | null> {
    const result = await tx.contentRequest.findFirst({
      where: { id, tenantId },
    });
    if (!result) return null;
    return this.mapToDomain(result);
  }

  async findMany(tenantId: string, tx: Prisma.TransactionClient, filters?: { status?: ContentStatus }): Promise<ContentRequestModel[]> {
    const where: Prisma.ContentRequestWhereInput = { tenantId };
    if (filters?.status) {
      where.status = filters.status as any;
    }
    const results = await tx.contentRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return results.map(this.mapToDomain);
  }

  async update(id: string, tenantId: string, data: UpdateContentRequestInput, tx: Prisma.TransactionClient): Promise<ContentRequestModel> {
    const updated = await tx.contentRequest.updateMany({
      where: { id, tenantId },
      data: {
        title: data.title,
        briefing: data.briefing,
        objective: data.objective,
        audience: data.audience,
        tone: data.tone,
        platform: data.platform ? data.platform as any : undefined,
        status: data.status ? data.status as any : undefined,
      },
    });

    if (updated.count === 0) {
      throw new Error("NOT_FOUND_OR_RLS_REJECTED");
    }

    return this.findById(id, tenantId, tx) as Promise<ContentRequestModel>;
  }
}
