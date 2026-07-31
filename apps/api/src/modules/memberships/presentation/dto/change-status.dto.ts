import { IsEnum } from 'class-validator';
import { MembershipStatus } from '@projeto/database';

export class ChangeStatusDto {
  @IsEnum(MembershipStatus)
  status!: MembershipStatus;
}
