import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ContentPlatform } from '../../domain/models/content-request.model';

export class UpdateContentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  briefing?: string;

  @IsString()
  @IsOptional()
  objective?: string;

  @IsString()
  @IsOptional()
  audience?: string;

  @IsString()
  @IsOptional()
  tone?: string;

  @IsEnum(ContentPlatform)
  @IsOptional()
  platform?: ContentPlatform;
}
