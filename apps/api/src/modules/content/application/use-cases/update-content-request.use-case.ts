import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContentRequestRepository } from '../../domain/repositories/content-request.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';
import { ContentRequestModel, ContentStatus } from '../../domain/models/content-request.model';

interface UpdateCommand {
  id: string;
  tenantId: string;
  title?: string;
  briefing?: string;
  objective?: string;
  audience?: string;
  tone?: string;
  platform?: string;
}

@Injectable()
export class UpdateContentRequestUseCase {
  constructor(
    private readonly repository: ContentRequestRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(command: UpdateCommand): Promise<ContentRequestModel> {
    return this.transactionService.execute({ tenantId: command.tenantId, userId: (command as any).userId } as any, async (tx) => {
      const existing = await this.repository.findById(command.id, command.tenantId, tx);
      if (!existing) throw new NotFoundException('CONTENT_NOT_FOUND');

      if (existing.status !== ContentStatus.DRAFT && existing.status !== ContentStatus.REJECTED) {
        throw new ForbiddenException('CANNOT_UPDATE_CONTENT_IN_CURRENT_STATUS');
      }

      try {
        return await this.repository.update(command.id, command.tenantId, {
          title: command.title,
          briefing: command.briefing,
          objective: command.objective,
          audience: command.audience,
          tone: command.tone,
          platform: command.platform,
        }, tx);
      } catch {
        throw new NotFoundException('CONTENT_NOT_FOUND');
      }
    });
  }
}
