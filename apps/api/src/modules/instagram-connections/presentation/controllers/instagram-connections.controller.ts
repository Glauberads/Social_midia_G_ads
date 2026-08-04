import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { StartOAuthFlowUseCase } from '../../application/use-cases/start-oauth-flow.use-case';
import { HandleOAuthCallbackUseCase } from '../../application/use-cases/handle-oauth-callback.use-case';
import { ListAvailableAccountsUseCase } from '../../application/use-cases/list-available-accounts.use-case';
import { SelectSocialAccountUseCase } from '../../application/use-cases/select-social-account.use-case';
import { GetSocialConnectionStatusUseCase } from '../../application/use-cases/get-social-connection-status.use-case';
import { DisconnectSocialConnectionUseCase } from '../../application/use-cases/disconnect-social-connection.use-case';
import { GetSocialConnectionHealthUseCase } from '../../application/use-cases/get-social-connection-health.use-case';
import { ValidateSocialConnectionUseCase } from '../../application/use-cases/validate-social-connection.use-case';
import { RefreshSocialConnectionUseCase } from '../../application/use-cases/refresh-social-connection.use-case';
import { ConnectDto, SelectAccountDto } from '../../application/dto/instagram-connections.dto';
import { TenantScoped } from '../../../auth/decorators/tenant-scoped.decorator';
import { RequireRoles } from '../../../auth/decorators/require-roles.decorator';
import { Public } from '../../../auth/decorators/public.decorator';
import { Role } from '@prisma/client';

/** Name of the HTTP-only session cookie. Never accessible by JavaScript. */
const SESSION_COOKIE = 'oauth_session';

/** TTL in seconds — must match OAuthSession TTL in the use case (15 min). */
const SESSION_COOKIE_MAX_AGE_SECONDS = 900;

@Controller('integrations/meta')
export class InstagramConnectionsController {
  constructor(
    private readonly startOAuthFlow: StartOAuthFlowUseCase,
    private readonly handleCallback: HandleOAuthCallbackUseCase,
    private readonly listAccounts: ListAvailableAccountsUseCase,
    private readonly selectAccount: SelectSocialAccountUseCase,
    private readonly getStatus: GetSocialConnectionStatusUseCase,
    private readonly disconnect: DisconnectSocialConnectionUseCase,
    private readonly getHealth: GetSocialConnectionHealthUseCase,
    private readonly validateConn: ValidateSocialConnectionUseCase,
    private readonly refreshConn: RefreshSocialConnectionUseCase,
  ) {}

  /** Step 1: Start OAuth flow — returns the Meta authorization URL */
  @Post('connect')
  @TenantScoped()
  @RequireRoles(Role.OWNER, Role.ADMIN)
  async connect(@Body() dto: ConnectDto) {
    const result = await this.startOAuthFlow.execute(dto.returnPath);
    return { authorizationUrl: result.authorizationUrl };
  }

  /**
   * Step 2: Callback from Meta.
   *
   * Security contract:
   * - The authorization code and raw state are NEVER forwarded to the frontend.
   * - The sessionId is NEVER placed in the redirect URL, response body, or any
   *   location accessible to JavaScript.
   * - The sessionId is transmitted only via an HTTP-only cookie with Secure,
   *   SameSite=Lax and a path restricted to the integrations API.
   * - Errors are represented by a sanitized `?result=` code — no credentials,
   *   no identifiers, no provider error messages.
   */
  @Get('callback')
  @Public()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      // User denied access or provider returned an error
      return res.redirect('/dashboard/settings/integrations?result=oauth_denied');
    }

    if (!code || !state) {
      return res.redirect('/dashboard/settings/integrations?result=oauth_failed');
    }

    try {
      const result = await this.handleCallback.execute(state, code);

      // Emit the session cookie — HTTP-only, never accessible by JavaScript
      res.cookie(SESSION_COOKIE, result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/integrations/meta',
        maxAge: SESSION_COOKIE_MAX_AGE_SECONDS * 1000, // express uses milliseconds
      });

      // Redirect to the frontend with no session identifier in the URL
      return res.redirect(result.returnPath);
    } catch {
      return res.redirect('/dashboard/settings/integrations?result=oauth_failed');
    }
  }

  /**
   * Step 3: List Instagram accounts available to the OAuth session.
   * The session is resolved from the HTTP-only cookie — NOT from a query param.
   */
  @Get('accounts')
  @TenantScoped()
  async accounts(@Req() req: Request) {
    const sessionId = (req.cookies as Record<string, string>)?.[SESSION_COOKIE];
    if (!sessionId) {
      throw new UnauthorizedException('No active OAuth session cookie.');
    }
    if (!isUUID(sessionId)) {
      throw new BadRequestException('Malformed session cookie.');
    }
    const accounts = await this.listAccounts.execute(sessionId);
    return { accounts };
  }

  /**
   * Step 4: Select account and finalize connection.
   * Session is resolved from the HTTP-only cookie.
   * Cookie is cleared upon success or definitive failure.
   */
  @Post('select-account')
  @TenantScoped()
  @RequireRoles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async selectSocialAccount(
    @Body() dto: SelectAccountDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const sessionId = (req.cookies as Record<string, string>)?.[SESSION_COOKIE];
    if (!sessionId) {
      throw new UnauthorizedException('No active OAuth session cookie.');
    }
    if (!isUUID(sessionId)) {
      throw new BadRequestException('Malformed session cookie.');
    }

    await this.selectAccount.execute({
      sessionId,
      instagramAccountId: dto.instagramAccountId,
      pageId: dto.pageId,
    });

    // Clear the session cookie — it has been consumed
    clearSessionCookie(res);
    return res.status(HttpStatus.NO_CONTENT).send();
  }

  /** Get current connection status (MEMBER-accessible, safe view — no tokens) */
  @Get('status')
  @TenantScoped()
  async status() {
    const result = await this.getStatus.execute();
    if (!result) return { connected: false };
    return {
      connected: result.status === 'CONNECTED',
      status: result.status,
      provider: result.provider,
      instagramUsername: result.instagramUsername,
      pageName: result.pageName,
      connectedAt: result.connectedAt,
      tokenExpiresAt: result.tokenExpiresAt,
      lastValidatedAt: result.lastValidatedAt,
    };
  }

  @Get('health')
  @TenantScoped()
  async health() {
    const result = await this.getHealth.execute();
    if (!result) return { connected: false };
    return {
      connected: result.status === 'CONNECTED',
      ...result,
    };
  }

  @Post('validate')
  @TenantScoped()
  @RequireRoles(Role.OWNER, Role.ADMIN)
  async validateRemote() {
    const result = await this.validateConn.execute();
    return result;
  }

  @Post('refresh')
  @TenantScoped()
  @RequireRoles(Role.OWNER, Role.ADMIN)
  async refreshRemote() {
    const result = await this.refreshConn.execute(true);
    return result;
  }

  /** Disconnect Meta/Instagram account */
  @Post('disconnect')
  @TenantScoped()
  @RequireRoles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnectAccount(@Res() res: Response) {
    await this.disconnect.execute();
    // Clear any lingering session cookie
    clearSessionCookie(res);
    return res.status(HttpStatus.NO_CONTENT).send();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clearSessionCookie(res: Response): void {
  res.cookie(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/integrations/meta',
    maxAge: 0,
  });
}

/** UUID v4 validation — prevents malformed values reaching the database */
function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
