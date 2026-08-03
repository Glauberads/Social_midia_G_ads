import { IsOptional, IsString, Matches } from 'class-validator';

export class ConnectDto {
  @IsOptional()
  @IsString()
  @Matches(/^\/dashboard\/settings\/integrations$/, {
    message: 'returnPath must be /dashboard/settings/integrations',
  })
  returnPath?: string;
}

export class SelectAccountDto {
  @IsString()
  instagramAccountId!: string;

  @IsString()
  pageId!: string;
}
