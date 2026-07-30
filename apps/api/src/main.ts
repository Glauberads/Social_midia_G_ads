import { NestFactory } from '@nestjs/core';
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
    
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Logger sanitizado: Nao logar headers sensiveis, logar requestId
    const requestId = (request as any)['requestId'];
    if (status >= 500) {
        this.logger.error(`[${requestId}] ${request.method} ${request.url} - ${status}`, exception instanceof Error ? exception.stack : exception);
    } else {
        this.logger.warn(`[${requestId}] ${request.method} ${request.url} - ${status}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      error: message,
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const webOrigin = configService.get<string>('WEB_ORIGIN', 'http://localhost:3000');
  const port = configService.get<number>('PORT', 3001);

  // RequestId Middleware
  app.use((req: Request, res: Response, next: () => void) => {
    (req as any)['requestId'] = req.headers['x-request-id'] || randomUUID();
    next();
  });

  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

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

  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}/api`);
}
bootstrap();
