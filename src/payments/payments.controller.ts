import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get('conciliation/:date')
  getConciliationReport(@Param('date') date: string) {
    return this.paymentsService.getConciliationReport(date);
  }

  @Get('status')
  getPaymentStatus() {
    return this.paymentsService.getPaymentStatus();
  }

  @Get('by-method/:methodId')
  getPaymentsByMethod(@Param('methodId') methodId: string) {
    return this.paymentsService.getPaymentsByMethod(+methodId);
  }

  @Get('by-date-range')
  getPaymentsByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.paymentsService.getPaymentsByDateRange(startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentsService.update(+id, updatePaymentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(+id);
  }
}
