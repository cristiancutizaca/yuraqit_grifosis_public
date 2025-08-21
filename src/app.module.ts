import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';

// Importa tus entidades
import { Product } from './entities/product.entity';
import { Client } from './entities/client.entity';
import { Employee } from './entities/employee.entity';
import { ProductsModule } from './products/products.module';
import { SettingsModule } from './settings/settings.module';
import { EmployeesModule } from './employees/employees.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { SaleDetailsModule } from './sale-details/sale-details.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { DeliveryDetailsModule } from './delivery-details/delivery-details.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { CreditsModule } from './credits/credits.module';
import { MeterReadingsModule } from './meter-readings/meter-readings.module';
import { NozzlesModule } from './nozzles/nozzles.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { PaymentsModule } from './payments/payments.module';
import { PumpsModule } from './pumps/pumps.module';
import { PumpsTanksModule } from './PumpsTanks/pumps-tanks.module';

import { SalesModule } from './sales/sales.module';
import { TanksModule } from './tanks/tanks.module';
import { ShiftsModule } from './shifts/shifts.module';
import { DiscountsModule } from './discounts/discounts.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(
      process.env.DATABASE_TYPE === 'sqlite'
        ? {
            type: 'better-sqlite3',
            database: process.env.DATABASE_PATH || './database.sqlite',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            logging: true,
          }
        : {
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USERNAME || 'grifosis_user',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_DATABASE || 'grifosis_db',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: false,
            logging: false,
          }
    ),
    TypeOrmModule.forFeature([
      Product,
      Client,
      Employee,
    ]),
    ProductsModule,
    SettingsModule,
    EmployeesModule,
    UsersModule,
    ClientsModule,
    SuppliersModule,
    DeliveriesModule,
    DeliveryDetailsModule,
    StockMovementsModule,
    ExpenseCategoriesModule,
    ExpensesModule,
    SaleDetailsModule,
    AuthModule,
    CreditsModule,
    MeterReadingsModule,
    NozzlesModule,
    PumpsModule,
    PumpsTanksModule,
    PaymentMethodsModule,
    PaymentsModule,
    SalesModule,
    TanksModule,
    ShiftsModule,
    DiscountsModule,
    CashRegisterModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
  
})
export class AppModule {}

