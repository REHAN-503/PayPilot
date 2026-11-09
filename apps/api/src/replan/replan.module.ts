import { Module } from '@nestjs/common';
import { ReplanService } from './replan.service.js';

@Module({
  providers: [ReplanService],
  exports: [ReplanService],
})
export class ReplanModule {}

