import { Prisma } from '@projeto/database';
import { ContentRequestModel, ContentStatus } from '../models/content-request.model';

export interface CreateContentRequestInput {
  title: string;
  briefing: string;
  objective?: string;
  audience?: string;
  tone?: string;
  platform: string;
  createdById: string;
  tenantId: string;
  status: ContentStatus;
}

export interface UpdateContentRequestInput {
  title?: string;
  briefing?: string;
  objective?: string;
  audience?: string;
  tone?: string;
  platform?: string;
  status?: ContentStatus;
}

export abstract class ContentRequestRepository {
  abstract create(data: CreateContentRequestInput, tx: Prisma.TransactionClient): Promise<ContentRequestModel>;
  abstract findById(id: string, tenantId: string, tx: Prisma.TransactionClient): Promise<ContentRequestModel | null>;
  abstract findMany(tenantId: string, tx: Prisma.TransactionClient, filters?: { status?: ContentStatus }): Promise<ContentRequestModel[]>;
  abstract update(id: string, tenantId: string, data: UpdateContentRequestInput, tx: Prisma.TransactionClient): Promise<ContentRequestModel>;
}
