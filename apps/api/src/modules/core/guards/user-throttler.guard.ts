import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user && req.user.userId) {
      return `user:${req.user.userId}`;
    }
    
    // IP fallback if userId is not present
    const ip = req.ip || req.connection?.remoteAddress || 'unknown-ip';
    return `ip:${ip}`;
  }
}
