import { Controller, Get, Post, Body, Patch, Param, Query } from '@nestjs/common';
import { CreditsService } from './credits.service';

@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) { }

  @Post()
  create(@Body() createCreditDto: any) {
    return this.creditsService.create(createCreditDto);
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('overdue') overdue?: string
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (overdue === 'true') filters.overdue = true;

    return this.creditsService.findAll(filters);
  }

  @Get('dashboard')
  getDashboard() {
    return this.creditsService.getCreditsDashboard();
  }

  @Get('overdue')
  getOverdueCredits() {
    return this.creditsService.getOverdueCredits();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.creditsService.findOne(+id);
  }

  @Post(':id/payments')
  addPayment(
    @Param('id') id: string,
    @Body() paymentData: { amount: number; payment_method_id: number; user_id: number; reference?: string }
  ) {
    return this.creditsService.addPayment(+id, paymentData.amount, paymentData.reference, paymentData.payment_method_id, paymentData.user_id);
  }
}

