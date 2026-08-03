import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { redactLog } from './modules/core/utils/redact.util';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, Catch, ArgumentsHost, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Catch()
class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as any)['requestId'] || randomUUID();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any = { message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        errorResponse = { ...res };
      } else {
        errorResponse = { message: res };
      }
    } else if (typeof exception === 'object' && exception !== null) {
      // Handle Prisma Known Errors without leaking SQL or DB structure
      if ('code' in exception && typeof (exception as any).code === 'string' && (exception as any).code.startsWith('P2')) {
        status = HttpStatus.CONFLICT;
        errorResponse = { message: 'Conflict on database operation', code: 'DB_CONFLICT' };
      }
    }

    // Logger sanitizado
    if (status >= 500) {
      this.logger.error(`[${requestId}] ${request.method} ${request.url} - ${status}`, redactLog(exception instanceof Error ? exception.stack : exception));
    } else {
      this.logger.warn(`[${requestId}] ${request.method} ${request.url} - ${status} - ${JSON.stringify(redactLog(errorResponse))}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      ...redactLog(errorResponse),
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const webOrigin = configService.get<string>('WEB_ORIGIN', 'http://localhost:3000');

  if (process.env.NODE_ENV === 'production' && webOrigin === '*') {
    throw new Error('Wildcard CORS (*) is forbidden in production');
  }
  const port = configService.get<number>('PORT', 3001);

  // RequestId Middleware
  app.use((req: Request, res: Response, next: () => void) => {
    (req as any)['requestId'] = req.headers['x-request-id'] || randomUUID();
    next();
  });

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin)
      if (!origin) {
        return callback(null, true);
      }
      if (webOrigin === '*' || webOrigin === origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-request-id'],
    credentials: true,
  });

  app.use(helmet());
  app.use(cookieParser());

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  Logger.log(`API running on http://127.0.0.1:${port}/api`);
}
bootstrap();
