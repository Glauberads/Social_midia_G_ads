import { Controller, Get, Req, Query, UseGuards } from '@nestjs/common';
import { ListCalendarUseCase } from '../application/use-cases/list-calendar.use-case';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator';
import { TenantScoped } from '../../auth/decorators/tenant-scoped.decorator';

@Controller('calendar')
@TenantScoped()
export class CalendarController {
  constructor(private readonly listCalendarUseCase: ListCalendarUseCase) {}

  @Get()
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  async getCalendar(@Req() req: any, @Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    if (!startDate || !endDate) {
      throw new Error("startDate and endDate are required");
    }
    return this.listCalendarUseCase.execute({
      tenantId: req.tenantScope.tenantId,
      userId: req.user.userId,
      startDate,
      endDate,
    });
  }
}
