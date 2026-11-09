import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type TimelineStage =
  | 'INTENT'
  | 'PLAN'
  | 'TOOL'
  | 'POLICY'
  | 'RISK'
  | 'APPROVAL'
  | 'PAYPAL'
  | 'WEBHOOK'
  | 'LEDGER'
  | 'NEGOTIATION'
  | 'RECOVERY';

export type TimelineActor = 'USER' | 'BUYER' | 'MERCHANT' | 'AGENT' | 'PAYPAL' | 'SYSTEM';

export type TimelineStatus = 'ok' | 'warn' | 'blocked' | 'pending';

export interface TimelineEvent {
  id: string;
  at: string; // ISO date string
  stage: TimelineStage;
  actor: string;
  title: string;
  explanation: string;
  status: TimelineStatus;
  data?: Record<string, any>;
}

@Injectable()
export class TimelineEmitter {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit(userId: string, event: TimelineEvent): void {
    this.emitter.emit(`timeline:${userId}`, event);
  }

  subscribe(userId: string, listener: (event: TimelineEvent) => void): () => void {
    const channel = `timeline:${userId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }
}
