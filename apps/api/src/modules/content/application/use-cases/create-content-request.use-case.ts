import { Injectable } from '@nestjs/common';
import { ContentRequestRepository } from '../../domain/repositories/content-request.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';
import { ContentRequestModel, ContentStatus } from '../../domain/models/content-request.model';

interface CreateCommand {
  tenantId: string;
  userId: string;
  title: string;
  briefing: string;
  objective?: string;
  audience?: string;
  tone?: string;
  platform: string;
}

@Injectable()
export class CreateContentRequestUseCase {
  constructor(
    private readonly repository: ContentRequestRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(command: CreateCommand): Promise<ContentRequestModel> {
    if (!command.briefing || command.briefing.length < 10) {
      throw new Error("INVALID_BRIEFING");
    }

    return this.transactionService.execute({ tenantId: command.tenantId, userId: (command as any).userId } as any, async (tx) => {
      return this.repository.create({
        ...command,
        createdById: command.userId,
        status: ContentStatus.DRAFT,
      }, tx);
    });
  }
}
