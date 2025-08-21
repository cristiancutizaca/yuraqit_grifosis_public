import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

// Importar todas las entidades necesarias para los reportes
import { Sale } from '../sales/entities/sale.entity';
import { SaleDetail } from '../sale-details/entities/sale-detail.entity';
import { Product } from '../products/entities/product.entity';
import { Client } from '../clients/entities/client.entity';
import { Employee } from '../employees/entities/employee.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { Tank } from '../tanks/entities/tank.entity';
import { StockMovement } from '../stock-movements/entities/stock-movement.entity';
import { Credit } from '../credits/entities/credit.entity';
import { Shift } from '../shifts/entities/shift.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleDetail,
      Product,
      Client,
      Employee,
      PaymentMethod,
      Tank,
      StockMovement,
      Credit,
      Shift,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

