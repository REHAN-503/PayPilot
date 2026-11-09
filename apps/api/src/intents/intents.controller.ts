import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
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

  @Post('stream')
  async createStream(
    @Body() body: unknown,
    @Session() session: UserSession,
    @Res() res: Response,
  ) {
    const parsed = createIntentSchema.safeParse(body);

    if (!parsed.success) {
      res.status(400).json({
        message: 'Invalid purchase intent',
        errors: parsed.error.issues,
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const onActivity = (activity: any) => {
      res.write(`event: activity\ndata: ${JSON.stringify(activity)}\n\n`);
    };

    try {
      const result = await this.intentsService.create(
        session.user.id,
        parsed.data.rawInput,
        onActivity,
      );
      res.write(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
    } catch (err: any) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err?.message || 'Streaming failed' })}\n\n`);
    } finally {
      res.end();
    }
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
