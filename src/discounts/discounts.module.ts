import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountsService } from './discounts.service';
import { DiscountsController } from './discounts.controller';
import { Discount } from './entities/discount.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Discount])], // 👈 esto es obligatorio
  controllers: [DiscountsController],
  providers: [DiscountsService],
})
export class DiscountsModule {}
