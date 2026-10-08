import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockProvider } from './providers/mock.provider';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MockProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
