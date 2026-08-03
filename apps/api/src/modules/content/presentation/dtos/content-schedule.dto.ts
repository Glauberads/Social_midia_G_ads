import { IsString, IsNotEmpty, IsDateString, IsOptional, MaxLength } from 'class-validator';

export class ScheduleContentDto {
  @IsNotEmpty()
  @IsDateString()
  localDateTime!: string;

  @IsNotEmpty()
  @IsString()
  timezone!: string;
}

export class CancelContentScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
