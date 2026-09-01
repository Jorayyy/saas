import { Module } from '@nestjs/common';
import { SelfHealingService } from './self-healing.service';
import { SelfHealingController } from './self-healing.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SelfHealingController],
  providers: [SelfHealingService],
  exports: [SelfHealingService],
})
export class SelfHealingModule {}
