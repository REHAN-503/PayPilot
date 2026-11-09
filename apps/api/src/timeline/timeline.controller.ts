import {
  Controller,
  Get,
  MessageEvent,
  Query,
  Sse,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { Observable } from 'rxjs';
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

