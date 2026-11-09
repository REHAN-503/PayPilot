import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class LlmRateLimitGuard {
  private readonly requests = new Map<string, { count: number; startedAt: number }>();
  private readonly windowMs = 60_000;
  private readonly maxRequests = 20;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = `${request.ip ?? 'unknown'}:${request.route?.path ?? request.path}`;
    const now = Date.now();
    const existing = this.requests.get(key);
    const current =
      !existing || now - existing.startedAt >= this.windowMs
        ? { count: 0, startedAt: now }
        : existing;

    current.count += 1;
    this.requests.set(key, current);
    if (current.count > this.maxRequests) {
      throw new HttpException(
        'LLM request rate limit exceeded. Please retry shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
