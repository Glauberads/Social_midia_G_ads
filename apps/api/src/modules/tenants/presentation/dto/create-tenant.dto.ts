import { IsString, MinLength, MaxLength, Matches, NotContains, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.toLowerCase().trim() : value)
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
  @Matches(/^[^-]/, { message: 'Slug cannot start with a hyphen' })
  @Matches(/[^-]$/, { message: 'Slug cannot end with a hyphen' })
  @NotContains('--', { message: 'Slug cannot contain consecutive hyphens' })
  slug!: string;
}
