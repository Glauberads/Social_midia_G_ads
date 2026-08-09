import { HttpException, HttpStatus } from '@nestjs/common';

export class MetaIntegrationNotConfiguredException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'A integração com o Meta não está configurada.',
        error: 'META_INTEGRATION_NOT_CONFIGURED',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
