import { Global, Module } from '@nestjs/common';
import { TokenEncryptionService } from './utils/crypto.service';

@Global()
@Module({
  providers: [TokenEncryptionService],
  exports: [TokenEncryptionService],
})
export class CoreModule {}
