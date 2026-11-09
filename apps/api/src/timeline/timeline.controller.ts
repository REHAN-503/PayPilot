import {
  Controller,
  Get,
  MessageEvent,
  Query,
  Res,
  Sse,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { Observable } from 'rxjs';
import type { Response } from 'express';
import { TimelineService } from './timeline.service.js';
import { TimelineEmitter, type TimelineEvent } from './timeline.emitter.js';

@Controller('timeline')
export class TimelineController {
  constructor(
    private readonly timelineService: TimelineService,
    private readonly timelineEmitter: TimelineEmitter,
  ) {}

  @Get()
  getTimeline(
    @Session() session: UserSession,
    @Query('intentId') intentId?: string,
    @Query('planId') planId?: string,
    @Query('paymentId') paymentId?: string,
  ): Promise<{ events: TimelineEvent[]; count: number }> {
    return this.timelineService.getTimeline(session.user.id, {
      intentId,
      planId,
      paymentId,
    });
  }

  @Get('export')
  async export(
    @Session() session: UserSession,
    @Query('format') format: 'csv' | 'json' = 'json',
    @Query('planId') planId: string | undefined,
    @Res() response: Response,
  ) {
    const result = await this.timelineService.getTimeline(session.user.id, { planId });
    if (format !== 'csv') return response.json(result.events);
    const rows = result.events.map((event) => [event.id, event.at, event.stage, event.actor, event.title, event.status, event.explanation]);
    const csv = [['id', 'at', 'stage', 'actor', 'title', 'status', 'explanation'], ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    response.type('text/csv').setHeader('Content-Disposition', 'attachment; filename="paypilot-timeline.csv"').send(csv);
  }

  @Sse('stream')
  streamEvents(@Session() session: UserSession): Observable<MessageEvent> {
    const userId = session.user.id;
    return new Observable<MessageEvent>((subscriber) => {
      // Send initial heartbeat
      subscriber.next({
        type: 'connected',
        data: { message: 'Timeline stream connected', userId },
      } as MessageEvent);

      const unsubscribe = this.timelineEmitter.subscribe(userId, (event: TimelineEvent) => {
        subscriber.next({
          type: 'timeline_event',
          data: event,
        } as MessageEvent);
      });

      return () => {
        unsubscribe();
      };
    });
  }
}
