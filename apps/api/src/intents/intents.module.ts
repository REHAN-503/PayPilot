import { Module } from '@nestjs/common';
import { IntentsController } from './intents.controller.js';
import { IntentsService } from './intents.service.js';

@Module({
  controllers: [IntentsController],
  providers: [IntentsService],
})
export class IntentsModule {}
