import { Controller, Get, Query, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { SalesByPeriodQueryDto } from '../sales/dto/sales-by-period.dto';
import { GetSalesByEmployeeDto } from './dto/get-sales-by-employee.dto';
import { GetSalesByProductDto } from './dto/get-sales-by-product.dto';
import { GetInventoryMovementsDto } from './dto/get-inventory-movements.dto';
import { GetCurrentStockDto } from './dto/get-current-stock.dto';
import { GetCashFlowDto } from './dto/get-cash-flow.dto';
import { GetIncomeVsExpensesDto } from './dto/get-income-vs-expenses.dto';
import { GetOutstandingCreditsDto } from './dto/get-outstanding-credits.dto';
import { GetCollectionsDto } from './dto/get-collections.dto';

@Controller('reports')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ==================== REPORTES DE VENTAS ====================
  // Endpoint unificado y optimizado para reportes de ventas
  @Get('sales/by-period')
  async getSalesByPeriod(@Query() q: SalesByPeriodQueryDto, @Res({ passthrough: true }) res: Response) {
    const data = await this.reportsService.getSalesAggregated(q);

    if (q.format === 'excel') {
      const buf = await this.reportsService.exportAggregationToExcel({
        rows: data,
        title: `Ventas por ${q.granularity ?? 'day'} (${q.startDate} a ${q.endDate})`,
        columns: this.reportsService.columnsForGranularity(q.granularity ?? 'day'),
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=ventas_${q.granularity ?? 'day'}_${q.startDate}_${q.endDate}.xlsx`);
      return res.send(buf);
    }

    if (q.format === 'pdf') {
      const buf = await this.reportsService.exportAggregationToPDF({
        rows: data,
        title: `Ventas por ${q.granularity ?? 'day'} (${q.startDate} a ${q.endDate})`,
        columns: this.reportsService.columnsForGranularity(q.granularity ?? 'day'),
        landscape: q.granularity === 'shift',
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ventas_${q.granularity ?? 'day'}_${q.startDate}_${q.endDate}.pdf`);
      return res.send(buf);
    }

    return data;
  }

  // Se ha refactorizado para usar un DTO y llamar a la vista de BD.
  @Get('sales/by-employee')
  async getSalesByEmployee(@Query() q: GetSalesByEmployeeDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.reportsService.getSalesSummaryByEmployee(); // Llama a la vista optimizada
    const rows = result.rankingData;

    if (q.format === 'excel') {
      const buf = await this.reportsService.exportAggregationToExcel({
        rows,
        title: `Ventas por empleado`,
        columns: [
          { header: 'Empleado', key: 'employee_name' },
          { header: 'Pedidos', key: 'orders' },
          { header: 'Total', key: 'total', currency: true },
        ],
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=ventas_por_empleado.xlsx`);
      return res.send(buf);
    }

    if (q.format === 'pdf') {
      const buf = await this.reportsService.exportAggregationToPDF({
        rows,
        title: `Ventas por empleado`,
        columns: [
          { header: 'Empleado', key: 'employee_name' },
          { header: 'Pedidos', key: 'orders' },
          { header: 'Total', key: 'total', currency: true },
        ],
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ventas_por_empleado.pdf`);
      return res.send(buf);
    }

    return result;
  }

  // Ahora utiliza un DTO
  @Get('sales/by-product')
  async getSalesByProduct(@Query() q: GetSalesByProductDto) {
    const startDate = q.startDate ?? '';
    const endDate = q.endDate ?? '';
    return this.reportsService.getSalesByProduct(startDate, endDate, q.limit, q.productId);
  }

  // ==================== REPORTES DE INVENTARIO ====================
  // Ahora utiliza un DTO
  @Get('inventory/current-stock')
  async getCurrentStock(@Query() q: GetCurrentStockDto) {
    return this.reportsService.getCurrentStock(q.productId, q.tankId);
  }

  // Ahora utiliza un DTO
  @Get('inventory/movements')
  async getInventoryMovements(@Query() q: GetInventoryMovementsDto) {
    const startDate = q.startDate ?? '';
    const endDate = q.endDate ?? '';
    const movementType = q.movementType ?? '';
    return this.reportsService.getInventoryMovements(startDate, endDate, movementType, q.productId, q.tankId);
  }

  // Ahora utiliza un DTO
  @Get('inventory/tank-variations')
  async getTankVariations(@Query() q: GetCurrentStockDto) {
    const startDate = q.startDate ?? '';
    const endDate = q.endDate ?? '';
    return this.reportsService.getTankVariations(startDate, endDate, q.tankId);
  }

  // ==================== REPORTES FINANCIEROS ====================
  // Ahora utiliza un DTO
  @Get('financial/income-vs-expenses')
  async getIncomeVsExpenses(@Query() q: GetIncomeVsExpensesDto) {
    const startDate = q.startDate ?? '';
    const endDate = q.endDate ?? '';
    const expenseCategory = q.expenseCategory ?? '';
    return this.reportsService.getIncomeVsExpenses(startDate, endDate, expenseCategory);
  }

  // Ahora utiliza un DTO
  @Get('financial/cash-flow')
  async getCashFlow(@Query() q: GetCashFlowDto) {
    const startDate = q.startDate ?? '';
    const endDate = q.endDate ?? '';
    const paymentMethod = q.paymentMethod ?? '';
    return this.reportsService.getCashFlow(startDate, endDate, paymentMethod);
  }

  // ==================== REPORTES DE CRÉDITOS ====================
  // Ahora utiliza un DTO
  @Get('credits/outstanding')
  async getOutstandingCredits(@Query() q: GetOutstandingCreditsDto) {
    const dueDateStart = q.dueDateStart ?? '';
    const dueDateEnd = q.dueDateEnd ?? '';
    const status = q.status ?? '';
    return this.reportsService.getOutstandingCredits(q.clientId, status, dueDateStart, dueDateEnd);
  }

  // Ahora utiliza un DTO
  @Get('credits/collections')
  async getCollections(@Query() q: GetCollectionsDto) {
    const startDate = q.startDate ?? '';
    const endDate = q.endDate ?? '';
    const paymentMethod = q.paymentMethod ?? '';
    return this.reportsService.getCollections(startDate, endDate, q.clientId, paymentMethod);
  }
}
