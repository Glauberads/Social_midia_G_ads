export enum ContentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  GENERATING = 'GENERATING',
  READY = 'READY',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED',
}

export enum ContentPlatform {
  INSTAGRAM_FEED = 'INSTAGRAM_FEED',
  INSTAGRAM_STORY = 'INSTAGRAM_STORY',
  INSTAGRAM_REEL = 'INSTAGRAM_REEL',
}

export class ContentRequestModel {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly createdById: string,
    public readonly title: string,
    public readonly briefing: string,
    public readonly objective: string | null,
    public readonly audience: string | null,
    public readonly tone: string | null,
    public readonly platform: ContentPlatform,
    public readonly status: ContentStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
