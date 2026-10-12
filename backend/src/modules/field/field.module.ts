import { Module } from '@nestjs/common';
import { FieldService } from './field.service';
import { FieldController } from './field.controller';
import { SellerFieldController } from './seller-field.controller';

@Module({
  controllers: [FieldController, SellerFieldController],
  providers: [FieldService],
  exports: [FieldService],
})
export class FieldModule {}
