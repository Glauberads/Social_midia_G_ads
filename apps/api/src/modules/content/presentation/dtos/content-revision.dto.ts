import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateContentRevisionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  callToAction?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Matches(/^#[\p{L}\p{N}_]+$/u, { each: true })
  hashtags?: string[];
}

export class RejectContentRevisionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ListContentRevisionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
