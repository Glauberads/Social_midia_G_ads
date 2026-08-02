import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ContentPlatform } from '../../domain/models/content-request.model';

export class CreateContentDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  briefing!: string;

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
  @IsNotEmpty()
  platform!: ContentPlatform;
}
