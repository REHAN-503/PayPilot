import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import {
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { createIntentSchema } from './intent.schema.js';
import { IntentsService } from './intents.service.js';

@Controller('intents')
export class IntentsController {
  constructor(private readonly intentsService: IntentsService) {}

  @Post()
  create(
    @Body() body: unknown,
    @Session() session: UserSession,
  ) {
    const parsed = createIntentSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid purchase intent',
        errors: parsed.error.issues,
      });
    }

    return this.intentsService.create(
      session.user.id,
      parsed.data.rawInput,
    );
  }

  @Get()
  findAll(@Session() session: UserSession) {
    return this.intentsService.findAll(session.user.id);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.intentsService.findOne(session.user.id, id);
  }
}
