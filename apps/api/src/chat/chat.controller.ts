import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { LlmRateLimitGuard } from '../common/rate-limit.guard.js';
import { ChatService } from './chat.service.js';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  @UseGuards(LlmRateLimitGuard)
  respond(@Body() body: { message?: unknown }, @Session() session: UserSession) {
    return this.chat.respond(session.user.id, body?.message);
  }
}
