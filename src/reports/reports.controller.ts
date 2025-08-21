import { Controller, Get, Query, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { SalesByPeriodQueryDto } from '../sales/dto/sales-by-period.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }
  // ==================== NUEVO ENDPOINT CON GRANULARIDAD ====================

  @Get('sales/by-period-granular')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getSalesByPeriodGranular(
    @Query() q: SalesByPeriodQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportsService.getSalesAggregated(q);

    if (q.format === 'excel') {
      const buffer = await this.reportsService.exportSalesAggregationToExcel(result, q);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const suffix = q.granularity ?? 'day';
      res.setHeader('Content-Disposition', `attachment; filename=reporte_ventas_${suffix}_${q.startDate}_${q.endDate}.xlsx`);
      return res.send(buffer);
    }

    return result;
  }

  // ==================== REPORTES DE VENTAS ====================

  @Get('sales/by-period')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
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
        landscape: (q.granularity === 'shift'),
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ventas_${q.granularity ?? 'day'}_${q.startDate}_${q.endDate}.pdf`);
      return res.send(buf);
    }

    return data;
  }

  @Get('sales/by-employee')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getSalesByEmployee(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'json' | 'excel' | 'pdf' = 'json',
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportsService.getSalesByEmployee(startDate, endDate);
    const rows = result.rankingData; // <-- usa el array

    if (format === 'excel') {
      const buf = await this.reportsService.exportAggregationToExcel({
        rows,
        title: `Ventas por empleado (${startDate} a ${endDate})`,
        columns: [
          { header: 'Empleado', key: 'employee_name' },
          { header: 'Pedidos', key: 'orders' },
          { header: 'Total', key: 'total', currency: true },
        ],
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=ventas_por_empleado_${startDate}_${endDate}.xlsx`);
      return res.send(buf);
    }

    if (format === 'pdf') {
      const buf = await this.reportsService.exportAggregationToPDF({
        rows,
        title: `Ventas por empleado (${startDate} a ${endDate})`,
        columns: [
          { header: 'Empleado', key: 'employee_name' },
          { header: 'Pedidos', key: 'orders' },
          { header: 'Total', key: 'total', currency: true },
        ],
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ventas_por_empleado_${startDate}_${endDate}.pdf`);
      return res.send(buf);
    }

    // En JSON devuelves todo el objeto con estadísticas
    return result;
  }

  // Nuevo endpoint: Ventas por Producto (top productos / mix)
  @Get('sales/by-product')
  async getSalesByProduct(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string,
    @Query('productId') productId?: string,
  ) {
    console.log('Generando reporte de ventas por producto:', {
      startDate,
      endDate,
      limit,
      productId,
    });

    return this.reportsService.getSalesByProduct(
      startDate,
      endDate,
      limit ? parseInt(limit) : undefined,
      productId ? parseInt(productId) : undefined,
    );
  }

  // ==================== REPORTES DE INVENTARIO ====================

  @Get('inventory/current-stock')
  async getCurrentStock(
    @Query('productId') productId?: string,
    @Query('tankId') tankId?: string,
  ) {
    console.log('Generando reporte de stock actual:', {
      productId,
      tankId,
    });

    return this.reportsService.getCurrentStock(
      productId ? parseInt(productId) : undefined,
      tankId ? parseInt(tankId) : undefined,
    );
  }

  @Get('inventory/movements')
  async getInventoryMovements(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('movementType') movementType?: string,
    @Query('productId') productId?: string,
    @Query('tankId') tankId?: string,
  ) {
    console.log('Generando reporte de movimientos de inventario:', {
      startDate,
      endDate,
      movementType,
      productId,
      tankId,
    });

    return this.reportsService.getInventoryMovements(
      startDate,
      endDate,
      movementType,
      productId ? parseInt(productId) : undefined,
      tankId ? parseInt(tankId) : undefined,
    );
  }

  // Nuevo endpoint: Variaciones de tanques en el tiempo
  @Get('inventory/tank-variations')
  async getTankVariations(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('tankId') tankId?: string,
  ) {
    console.log('Generando reporte de variaciones de tanques:', {
      startDate,
      endDate,
      tankId,
    });

    return this.reportsService.getTankVariations(
      startDate,
      endDate,
      tankId ? parseInt(tankId) : undefined,
    );
  }

  // ==================== REPORTES FINANCIEROS ====================

  @Get('financial/income-vs-expenses')
  async getIncomeVsExpenses(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('expenseCategory') expenseCategory?: string,
  ) {
    console.log('Generando reporte de ingresos vs egresos:', {
      startDate,
      endDate,
      expenseCategory,
    });

    return this.reportsService.getIncomeVsExpenses(
      startDate,
      endDate,
      expenseCategory,
    );
  }

  @Get('financial/cash-flow')
  async getCashFlow(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    console.log('Generando reporte de flujo de caja:', {
      startDate,
      endDate,
      paymentMethod,
    });

    return this.reportsService.getCashFlow(
      startDate,
      endDate,
      paymentMethod,
    );
  }

  // ==================== REPORTES DE CRÉDITOS ====================

  @Get('credits/outstanding')
  async getOutstandingCredits(
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('dueDateStart') dueDateStart?: string,
    @Query('dueDateEnd') dueDateEnd?: string,
  ) {
    console.log('Generando reporte de créditos pendientes:', {
      clientId,
      status,
      dueDateStart,
      dueDateEnd,
    });

    return this.reportsService.getOutstandingCredits(
      clientId ? parseInt(clientId) : undefined,
      status,
      dueDateStart,
      dueDateEnd,
    );
  }

  @Get('credits/collections')
  async getCollections(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('clientId') clientId?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    console.log('Generando reporte de cobros:', {
      startDate,
      endDate,
      clientId,
      paymentMethod,
    });

    return this.reportsService.getCollections(
      startDate,
      endDate,
      clientId ? parseInt(clientId) : undefined,
      paymentMethod,
    );
  }
}

