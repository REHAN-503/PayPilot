import { Module } from '@nestjs/common';
import { TimelineEmitter } from './timeline.emitter.js';
import { TimelineService } from './timeline.service.js';
import { TimelineController } from './timeline.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [TimelineController],
  providers: [TimelineEmitter, TimelineService],
  exports: [TimelineEmitter, TimelineService],
})
export class TimelineModule {}

