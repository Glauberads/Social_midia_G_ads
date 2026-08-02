import { Controller, Post, Get, Patch, Body, Param, Req, UseGuards, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CreateContentRequestUseCase } from '../application/use-cases/create-content-request.use-case';
import { ListContentRequestsUseCase } from '../application/use-cases/list-content-requests.use-case';
import { GetContentRequestUseCase } from '../application/use-cases/get-content-request.use-case';
import { UpdateContentRequestUseCase } from '../application/use-cases/update-content-request.use-case';
import { ArchiveContentRequestUseCase } from '../application/use-cases/archive-content-request.use-case';
import { CreateContentDto } from './dtos/create-content.dto';
import { UpdateContentDto } from './dtos/update-content.dto';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator';
import { TenantScoped } from '../../auth/decorators/tenant-scoped.decorator';
import { SubmitContentRequestUseCase } from '../application/use-cases/submit-content-request.use-case';

@Controller('content-requests')
@TenantScoped()
export class ContentController {
  constructor(
    private readonly createUseCase: CreateContentRequestUseCase,
    private readonly listUseCase: ListContentRequestsUseCase,
    private readonly getUseCase: GetContentRequestUseCase,
    private readonly updateUseCase: UpdateContentRequestUseCase,
    private readonly archiveUseCase: ArchiveContentRequestUseCase,
    private readonly submitUseCase: SubmitContentRequestUseCase,
  ) {}

  @Post()
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async create(@Req() req: any, @Body() dto: CreateContentDto) {
    return this.createUseCase.execute({
      tenantId: req.tenantScope.tenantId,
      userId: req.user.userId,
      ...dto,
    });
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async submit(@Req() req: any, @Param('id') id: string) {
    return this.submitUseCase.execute({ contentRequestId: id, tenantId: req.tenantScope.tenantId, userId: req.user.userId, requestId: req.requestId });
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async retry(@Req() req: any, @Param('id') id: string) {
    return this.submitUseCase.execute({ contentRequestId: id, tenantId: req.tenantScope.tenantId, userId: req.user.userId, requestId: req.requestId, retryFailed: true });
  }

  @Get()
  async list(@Req() req: any, @Query('status') status?: string) {
    return this.listUseCase.execute(req.tenantScope.tenantId, status as any);
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    return this.getUseCase.execute(id, req.tenantScope.tenantId);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateContentDto) {
    return this.updateUseCase.execute({
      id,
      tenantId: req.tenantScope.tenantId,
      ...dto,
    });
  }

  @Post(':id/archive')
  async archive(@Req() req: any, @Param('id') id: string) {
    await this.archiveUseCase.execute(id, req.tenantScope.tenantId);
    return { success: true };
  }
}
