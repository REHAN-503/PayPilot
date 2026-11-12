import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { LlmRateLimitGuard } from '../common/rate-limit.guard.js';
import { ChatService } from './chat.service.js';
import { isDemoAccount } from '../auth/demo-account.js';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  @UseGuards(LlmRateLimitGuard)
  respond(@Body() body: { message?: unknown }, @Session() session: UserSession) {
    if (isDemoAccount(session.user.email)) {
      throw new ForbiddenException(
        'AI chat is disabled for the shared demo account. Sign in with your own account to use live AI. Your API service must have a valid OpenRouter API key configured.',
      );
    }
    return this.chat.respond(session.user.id, body?.message);
  }
}
