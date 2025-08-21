import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import * as ExcelJS from 'exceljs';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
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
import { SalesByPeriodQueryDto, Granularity } from '../sales/dto/sales-by-period.dto';

type ColumnDef = { header: string; key: string; currency?: boolean; width?: number };

@Injectable()
export class ReportsService {
  private readonly tz = 'America/Lima';

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleDetail)
    private readonly saleDetailRepository: Repository<SaleDetail>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Tank)
    private readonly tankRepository: Repository<Tank>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(Credit)
    private readonly creditRepository: Repository<Credit>,
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
  ) { }

  // ==================== MÉTODOS AUXILIARES PARA GRANULARIDAD ====================

  private formatDateLima(d: Date | string) {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // YYYY-MM-DD
  }

  columnsForGranularity(granularity: 'day' | 'week' | 'month' | 'shift'): ColumnDef[] {
    if (granularity === 'shift') {
      return [
        { header: 'Turno', key: 'shift_name', width: 28 },
        { header: 'Pedidos', key: 'orders' },
        { header: 'Total', key: 'total', currency: true },
      ];
    }
    return [
      { header: 'Bucket', key: 'bucket', width: 18 },
      { header: 'Pedidos', key: 'orders' },
      { header: 'Total', key: 'total', currency: true },
    ];
  }

  private applyFilters(qb: SelectQueryBuilder<Sale>, q: SalesByPeriodQueryDto) {
    qb.where('sale.sale_timestamp::date BETWEEN :start::date AND :end::date', {
      start: q.startDate, end: q.endDate,
    });

    if (q.productId) {
      qb.andWhere('sd.product_id = :productId', { productId: q.productId })
        .leftJoin('sale.saleDetails', 'sd');
    }

    if (q.employeeId) {
      qb.andWhere('sale.employee_id = :employeeId', { employeeId: q.employeeId });
    }

    if (q.clientId) {
      qb.andWhere('sale.client_id = :clientId', { clientId: q.clientId });
    }

    if (q.paymentMethod) {
      // ojo: campo correcto en tu entidad es method_name
      qb.leftJoin('sale.paymentMethod', 'pm')
        .andWhere('pm.method_name = :pm', { pm: q.paymentMethod });
    }

    return qb;
  }

  private buildTimeBucket(granularity: Granularity) {
    // Convertimos timestamp a la zona Lima y truncamos
    if (granularity === 'week') return `date_trunc('week',  sale.sale_timestamp AT TIME ZONE '${this.tz}')`;
    if (granularity === 'month') return `date_trunc('month', sale.sale_timestamp AT TIME ZONE '${this.tz}')`;
    // por día por defecto
    return `date_trunc('day',   sale.sale_timestamp AT TIME ZONE '${this.tz}')`;
  }

  async getSalesAggregated(q: SalesByPeriodQueryDto) {
    const gran = q.granularity ?? 'day';

    if (gran === 'shift') {
      // Método mejorado para agrupar por shift usando query builder optimizado
      const qb = this.saleRepository.createQueryBuilder('sale');

      this.applyFilters(qb, q);

      qb.select('COALESCE(sale.shift, \'Sin turno\')', 'shift_name')
        .addSelect('COUNT(*)', 'orders')
        .addSelect('SUM(sale.total_amount)', 'total')
        .groupBy('sale.shift')
        .orderBy('shift_name', 'ASC');

      const rawResults = await qb.getRawMany();

      // Transformar resultados para mantener consistencia
      return rawResults.map(row => ({
        shift_name: row.shift_name,
        orders: Number(row.orders || 0),
        total: Number(row.total || 0),
      }));
    }

    // Día / Semana / Mes
    const bucketExpr = this.buildTimeBucket(gran);
    const qb = this.saleRepository.createQueryBuilder('sale')
      .select(`${bucketExpr}`, 'bucket')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('SUM(sale.total_amount)', 'total');

    this.applyFilters(qb, q);

    qb.groupBy('bucket').orderBy('bucket', 'ASC');

    const rows = await qb.getRawMany();

    // Normaliza salida: bucket -> ISO date (día) o inicio de semana/mes
    const data = rows.map(r => ({
      bucket: r.bucket instanceof Date
        ? r.bucket.toISOString()
        : r.bucket, // PG devuelve timestamp; Nest lo parsea a Date
      orders: Number(r.orders ?? 0),
      total: Number(r.total ?? 0),
    }));

    return data;
  }

  async exportSalesAggregationToExcel(rows: any[], q: SalesByPeriodQueryDto): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ventas');

    const isShift = (q.granularity ?? 'day') === 'shift';
    if (isShift) {
      ws.addRow(['Turno', 'Pedidos', 'Total']);
      rows.forEach(r => ws.addRow([r.shift_name ?? r.shift_id ?? 'Sin turno', r.orders ?? 0, Number(r.total ?? 0)]));
      ws.getColumn(3).numFmt = '#,##0.00';
    } else {
      ws.addRow(['Bucket', 'Pedidos', 'Total']);
      rows.forEach(r => ws.addRow([r.bucket, r.orders ?? 0, Number(r.total ?? 0)]));
      ws.getColumn(3).numFmt = '#,##0.00';
    }

    ws.autoFilter = { from: 'A1', to: 'C1' };
    ws.columns.forEach(col => { col.width = 18; });
    ws.getRow(1).font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ==================== REPORTES DE VENTAS ====================

  async getSalesByPeriod(
    startDate: string,
    endDate: string,
    productId?: number,
    clientId?: number,
    employeeId?: number,
    shiftId?: number,
  ) {
    const queryBuilder = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.saleDetails', 'saleDetail')
      .leftJoinAndSelect('saleDetail.product', 'product')
      .leftJoinAndSelect('sale.client', 'client')
      .leftJoinAndSelect('sale.employee', 'employee')
      .leftJoinAndSelect('sale.paymentMethod', 'paymentMethod')
      .where('sale.sale_timestamp BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });

    if (productId) {
      queryBuilder.andWhere('product.product_id = :productId', { productId });
    }
    if (clientId) {
      queryBuilder.andWhere('client.client_id = :clientId', { clientId });
    }
    if (employeeId) {
      queryBuilder.andWhere('employee.employee_id = :employeeId', { employeeId });
    }
    // shiftId solo si existe en tu entity/tabla, si no, comenta o elimina esta parte
    // if (shiftId) {
    //   queryBuilder.andWhere('sale.shift_id = :shiftId', { shiftId });
    // }

    const sales = await queryBuilder.getMany();

    // Calcular métricas
    const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount.toString()), 0);
    const totalQuantity = sales.reduce((sum, sale) =>
      sum + sale.saleDetails.reduce((detailSum, detail) => detailSum + parseFloat(detail.quantity.toString()), 0), 0
    );
    const averageTransaction = sales.length > 0 ? totalSales / sales.length : 0;

    // Ventas por producto
    const salesByProduct = {};
    sales.forEach(sale => {
      sale.saleDetails.forEach(detail => {
        const productName = detail.product.name;
        if (!salesByProduct[productName]) {
          salesByProduct[productName] = { quantity: 0, amount: 0 };
        }
        salesByProduct[productName].quantity += parseFloat(detail.quantity.toString());
        salesByProduct[productName].amount += parseFloat(detail.subtotal.toString());
      });
    });

    // Ventas por método de pago
    const salesByPaymentMethod = {};
    sales.forEach(sale => {
      const paymentMethodName = sale.paymentMethod?.method_name || 'Sin especificar';
      if (!salesByPaymentMethod[paymentMethodName]) {
        salesByPaymentMethod[paymentMethodName] = 0;
      }
      salesByPaymentMethod[paymentMethodName] += parseFloat(sale.total_amount.toString());
    });

    // Datos de línea de tiempo (agrupados por día)
    const timelineData = {};
    sales.forEach(sale => {
      const date = sale.sale_timestamp.toISOString().split('T')[0];
      if (!timelineData[date]) {
        timelineData[date] = { sales: 0, quantity: 0 };
      }
      timelineData[date].sales += parseFloat(sale.total_amount.toString());
      timelineData[date].quantity += sale.saleDetails.reduce((sum, detail) =>
        sum + parseFloat(detail.quantity.toString()), 0
      );
    });

    return {
      totalSales,
      totalQuantity,
      averageTransaction,
      salesByProduct,
      salesByPaymentMethod,
      timelineData,
      salesCount: sales.length,
    };
  }

  async getSalesByEmployee(
    startDate: string,
    endDate: string,
    employeeId?: number,
    shiftId?: number,
  ) {
    // Método mejorado usando query builder optimizado
    const queryBuilder = this.saleRepository
      .createQueryBuilder('s')
      .leftJoin("sales.user", "u")
      .addSelect("u.full_name", "user_full_name")
      .select('e.employee_id', 'employee_id')
      .addSelect("concat_ws(' ', e.first_name, e.last_name)", "employee_name")
      .addSelect('COUNT(*)', 'orders')
      .addSelect('SUM(s.total_amount)', 'total')
      .where('s.sale_timestamp::date BETWEEN :startDate::date AND :endDate::date', {
        startDate,
        endDate,
      })
      .groupBy('e.employee_id')
      .addGroupBy('e.full_name')
      .orderBy('total', 'DESC');

    if (employeeId) {
      queryBuilder.andWhere('e.employee_id = :employeeId', { employeeId });
    }

    const rawResults = await queryBuilder.getRawMany();

    // Transformar resultados para mantener compatibilidad con el formato anterior
    const employeeSales = {};
    const rankingData = rawResults.map(row => {
      const employeeName = row.employee_name || 'Sin vendedor';
      const data = {
        employee_id: row.employee_id,
        totalSales: Number(row.total || 0),
        salesCount: Number(row.orders || 0),
        orders: Number(row.orders || 0),
        total: Number(row.total || 0),
      };

      employeeSales[employeeName] = data;

      return {
        name: employeeName,
        ...data,
      };
    });

    return {
      employeeSales,
      rankingData,
      totalEmployees: Object.keys(employeeSales).length,
    };
  }

  // Nuevo método: Ventas por Producto (top productos / mix)
  async getSalesByProduct(
    startDate: string,
    endDate: string,
    limit?: number,
    productId?: number,
  ) {
    const queryBuilder = this.saleRepository
      .createQueryBuilder('s')
      .leftJoin('s.saleDetails', 'sd')
      .leftJoin('sd.product', 'p')
      .select('p.product_id', 'product_id')
      .addSelect('p.name', 'product_name')
      .addSelect('SUM(sd.quantity)', 'qty')
      .addSelect('SUM(sd.quantity * sd.unit_price)', 'revenue')
      .where('s.sale_timestamp::date BETWEEN :startDate::date AND :endDate::date', {
        startDate,
        endDate,
      })
      .groupBy('p.product_id')
      .addGroupBy('p.name')
      .orderBy('revenue', 'DESC');

    if (productId) {
      queryBuilder.andWhere('p.product_id = :productId', { productId });
    }

    if (limit) {
      queryBuilder.limit(limit);
    } else {
      queryBuilder.limit(10); // Límite por defecto
    }

    const rawResults = await queryBuilder.getRawMany();

    // Transformar resultados
    const productSales = rawResults.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name || 'Producto sin nombre',
      quantity: Number(row.qty || 0),
      revenue: Number(row.revenue || 0),
      qty: Number(row.qty || 0), // Mantener compatibilidad
    }));

    const totalRevenue = productSales.reduce((sum, product) => sum + product.revenue, 0);
    const totalQuantity = productSales.reduce((sum, product) => sum + product.quantity, 0);

    return {
      productSales,
      totalRevenue,
      totalQuantity,
      productsCount: productSales.length,
    };
  }


  // ==================== REPORTES DE INVENTARIO ====================

  async getCurrentStock(productId?: number, tankId?: number) {
    const queryBuilder = this.tankRepository
      .createQueryBuilder('tank')
      .leftJoinAndSelect('tank.product', 'product');

    if (productId) {
      queryBuilder.andWhere('product.product_id = :productId', { productId });
    }
    if (tankId) {
      queryBuilder.andWhere('tank.tank_id = :tankId', { tankId });
    }

    const tanks = await queryBuilder.getMany();

    const stockData = tanks.map(tank => {
      const currentStock = parseFloat(tank.current_stock?.toString() || '0');
      const capacity = parseFloat(tank.capacity?.toString() || '1');
      const fillPercentage = (currentStock / capacity) * 100;
      const isLowStock = fillPercentage < 20; // Umbral del 20%

      return {
        tankId: tank.tank_id,
        tankName: tank.name,
        productId: tank.product?.product_id,
        productName: tank.product?.name,
        currentStock,
        capacity,
        fillPercentage: Math.round(fillPercentage * 100) / 100,
        isLowStock,
      };
    });

    return stockData;
  }

  async getInventoryMovements(
    startDate: string,
    endDate: string,
    movementType?: string,
    productId?: number,
    tankId?: number,
  ) {
    // Método mejorado usando query builder optimizado según pasted content
    const queryBuilder = this.stockMovementRepository
      .createQueryBuilder('m')
      .leftJoin('m.product', 'p')
      .leftJoin('m.tank', 't')
      .select('m.movement_type', 'type')        // in | out | adjust
      .addSelect('p.product_id', 'product_id')
      .addSelect('p.name', 'product_name')
      .addSelect('t.tank_id', 'tank_id')
      .addSelect('t.name', 'tank_name')
      .addSelect('SUM(m.quantity)', 'quantity')
      .addSelect('MIN(m.created_at)', 'first_at')
      .addSelect('MAX(m.created_at)', 'last_at')
      .where('m.created_at::date BETWEEN :startDate::date AND :endDate::date', {
        startDate,
        endDate,
      })
      .groupBy('m.movement_type')
      .addGroupBy('p.product_id').addGroupBy('p.name')
      .addGroupBy('t.tank_id').addGroupBy('t.name')
      .orderBy('last_at', 'DESC');

    if (movementType) {
      queryBuilder.andWhere('m.movement_type = :type', { type: movementType });
    }
    if (productId) {
      queryBuilder.andWhere('p.product_id = :productId', { productId });
    }
    if (tankId) {
      queryBuilder.andWhere('t.tank_id = :tankId', { tankId });
    }

    const rawResults = await queryBuilder.getRawMany();

    // Calcular totales optimizados
    const totalIn = rawResults
      .filter(m => m.type === 'in' || m.type === 'Entrada')
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

    const totalOut = rawResults
      .filter(m => m.type === 'out' || m.type === 'Salida')
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

    const netAdjustments = rawResults
      .filter(m => m.type === 'adjust' || m.type === 'Ajuste')
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

    // Transformar resultados para mantener compatibilidad
    const movementDetails = rawResults.map(row => ({
      movement_type: row.type,
      product_id: row.product_id,
      product_name: row.product_name,
      tank_id: row.tank_id,
      tank_name: row.tank_name,
      quantity: Number(row.quantity || 0),
      first_at: row.first_at,
      last_at: row.last_at,
    }));

    return {
      totalIn,
      totalOut,
      netAdjustments,
      movementDetails,
      movementsCount: rawResults.length,
    };
  }

  // Nuevo método: Variación por tanque en el tiempo (serie temporal)
  async getTankVariations(
    startDate: string,
    endDate: string,
    tankId?: number,
  ) {
    const queryBuilder = this.stockMovementRepository
      .createQueryBuilder('m')
      .select("date_trunc('day', m.created_at AT TIME ZONE 'America/Lima')", 'bucket')
      .addSelect('m.tank_id', 'tank_id')
      .addSelect('SUM(CASE WHEN m.movement_type = \'in\' OR m.movement_type = \'Entrada\' THEN m.quantity ELSE -m.quantity END)', 'net_qty')
      .where('m.created_at::date BETWEEN :startDate::date AND :endDate::date', {
        startDate,
        endDate,
      })
      .groupBy('bucket').addGroupBy('m.tank_id')
      .orderBy('bucket', 'ASC');

    if (tankId) {
      queryBuilder.andWhere('m.tank_id = :tankId', { tankId });
    }

    const rawResults = await queryBuilder.getRawMany();

    // Transformar resultados
    const variations = rawResults.map(row => ({
      date: row.bucket instanceof Date ? row.bucket.toISOString().split('T')[0] : row.bucket,
      tank_id: row.tank_id,
      net_quantity: Number(row.net_qty || 0),
      bucket: row.bucket,
    }));

    return {
      variations,
      totalVariations: variations.length,
    };
  }

  // ==================== REPORTES FINANCIEROS ====================

  async getIncomeVsExpenses(
    startDate: string,
    endDate: string,
    expenseCategory?: string,
  ) {
    // Ingresos (ventas)
    const salesQuery = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.sale_timestamp BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });

    const sales = await salesQuery.getMany();
    const totalIncome = sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount.toString()), 0);

    // Para gastos, necesitarías una entidad de gastos/egresos
    // Por ahora simularemos con datos básicos
    const totalExpenses = 0; // Implementar cuando tengas entidad de gastos
    const netProfit = totalIncome - totalExpenses;

    // Datos mensuales (simplificado)
    const monthlyData = {};
    sales.forEach(sale => {
      const month = sale.sale_timestamp.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expenses: 0 };
      }
      monthlyData[month].income += parseFloat(sale.total_amount.toString());
    });

    return {
      totalIncome,
      totalExpenses,
      netProfit,
      monthlyComparisonData: monthlyData,
      expenseDistributionData: {}, // Implementar cuando tengas categorías de gastos
    };
  }

  async getCashFlow(
    startDate: string,
    endDate: string,
    paymentMethod?: string,
  ) {
    const queryBuilder = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.paymentMethod', 'paymentMethod')
      .where('sale.sale_timestamp BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });

    if (paymentMethod) {
      queryBuilder.andWhere('paymentMethod.name = :paymentMethod', { paymentMethod });
    }

    const sales = await queryBuilder.getMany();

    const cashReceived = sales
      .filter(sale => sale.paymentMethod?.method_name === 'Efectivo')
      .reduce((sum, sale) => sum + parseFloat(sale.total_amount.toString()), 0);

    const transfersReceived = sales
      .filter(sale => sale.paymentMethod?.method_name === 'Transferencia')
      .reduce((sum, sale) => sum + parseFloat(sale.total_amount.toString()), 0);

    // Flujo diario
    const dailyFlowData = {};
    sales.forEach(sale => {
      const date = sale.sale_timestamp.toISOString().split('T')[0];
      if (!dailyFlowData[date]) {
        dailyFlowData[date] = 0;
      }
      dailyFlowData[date] += parseFloat(sale.total_amount.toString());
    });

    return {
      cashReceived,
      transfersReceived,
      creditsData: {}, // Implementar con datos de créditos
      dailyFlowData,
      projectionsData: {}, // Implementar proyecciones
    };
  }

  // ==================== REPORTES DE CRÉDITOS ====================

  async getOutstandingCredits(
    clientId?: number,
    status?: string,
    dueDateStart?: string,
    dueDateEnd?: string,
  ) {
    // Método mejorado usando query builder optimizado según pasted content
    const queryBuilder = this.creditRepository
      .createQueryBuilder('c')
      .leftJoin('c.client', 'cl')
      .select('c.credit_id', 'credit_id')
      .addSelect('cl.client_id', 'client_id')
      .addSelect('cl.name', 'client_name')
      .addSelect('c.total_amount - COALESCE(c.amount_paid, 0)', 'balance')
      .addSelect('c.due_date', 'due_date')
      .addSelect('c.total_amount', 'total_amount')
      .addSelect('c.amount_paid', 'amount_paid')
      .where('c.due_date::date BETWEEN :dueDateStart::date AND :dueDateEnd::date', {
        dueDateStart: dueDateStart || '1900-01-01',
        dueDateEnd: dueDateEnd || '2099-12-31',
      })
      .andWhere('(c.total_amount - COALESCE(c.amount_paid, 0)) > 0');

    if (clientId) {
      queryBuilder.andWhere('cl.client_id = :clientId', { clientId });
    }

    if (status === 'overdue') {
      queryBuilder.andWhere('c.due_date < NOW()');
    }

    queryBuilder.orderBy('c.due_date', 'ASC');

    const rawResults = await queryBuilder.getRawMany();

    const totalOutstanding = rawResults.reduce((sum, credit) =>
      sum + Number(credit.balance || 0), 0
    );

    const partialPayments = rawResults.reduce((sum, credit) =>
      sum + Number(credit.amount_paid || 0), 0
    );

    // Aging de cuentas mejorado
    const now = new Date();
    const agingData = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    };

    const creditsDetails = rawResults.map(credit => {
      const dueDate = new Date(credit.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const balance = Number(credit.balance || 0);

      if (daysOverdue <= 30) {
        agingData['0-30'] += balance;
      } else if (daysOverdue <= 60) {
        agingData['31-60'] += balance;
      } else if (daysOverdue <= 90) {
        agingData['61-90'] += balance;
      } else {
        agingData['90+'] += balance;
      }

      return {
        credit_id: credit.credit_id,
        client_id: credit.client_id,
        client_name: credit.client_name,
        balance: balance,
        due_date: credit.due_date,
        total_amount: Number(credit.total_amount || 0),
        amount_paid: Number(credit.amount_paid || 0),
        days_overdue: daysOverdue,
        is_overdue: daysOverdue > 0,
      };
    });

    return {
      totalOutstanding,
      partialPayments,
      agingData,
      creditsDetails,
      delinquentClients: creditsDetails.filter(c => c.is_overdue),
      creditsCount: creditsDetails.length,
    };
  }

  async getCollections(
    startDate: string,
    endDate: string,
    clientId?: number,
    paymentMethod?: string,
  ) {
    // Implementación mejorada según pasted content
    // Nota: Este método requiere una entidad Payment relacionada con Credit
    // Por ahora implementamos una estructura básica que puede ser expandida

    // Si existe una tabla de pagos de créditos, usar este query:
    /*
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('pay')
      .leftJoin('pay.credit', 'c')
      .leftJoin('pay.paymentMethod', 'pm')
      .leftJoin('c.client', 'cl')
      .select("date_trunc('day', pay.paid_at AT TIME ZONE 'America/Lima')", 'bucket')
      .addSelect('pm.method_name', 'payment_method')
      .addSelect('SUM(pay.amount)', 'total')
      .addSelect('cl.client_id', 'client_id')
      .addSelect('cl.name', 'client_name')
      .where('pay.paid_at::date BETWEEN :startDate::date AND :endDate::date', {
        startDate,
        endDate,
      })
      .groupBy('bucket')
      .addGroupBy('pm.method_name')
      .addGroupBy('cl.client_id')
      .addGroupBy('cl.name')
      .orderBy('bucket', 'ASC');

    if (clientId) {
      queryBuilder.andWhere('cl.client_id = :clientId', { clientId });
    }
    if (paymentMethod) {
      queryBuilder.andWhere('pm.method_name = :method', { method: paymentMethod });
    }

    const rawResults = await queryBuilder.getRawMany();
    */

    // Implementación básica usando los créditos existentes
    const queryBuilder = this.creditRepository
      .createQueryBuilder('c')
      .leftJoin('c.client', 'cl')
      .select('c.credit_id', 'credit_id')
      .addSelect('cl.client_id', 'client_id')
      .addSelect('cl.name', 'client_name')
      .addSelect('c.amount_paid', 'amount_paid')
      .addSelect('c.updated_at', 'payment_date')
      .where('c.updated_at::date BETWEEN :startDate::date AND :endDate::date', {
        startDate,
        endDate,
      })
      .andWhere('c.amount_paid > 0');

    if (clientId) {
      queryBuilder.andWhere('cl.client_id = :clientId', { clientId });
    }

    const rawResults = await queryBuilder.getRawMany();

    const totalCollections = rawResults.reduce((sum, payment) =>
      sum + Number(payment.amount_paid || 0), 0
    );

    // Datos de cobros por día
    const collectionTrends = {};
    rawResults.forEach(payment => {
      const date = payment.payment_date ?
        new Date(payment.payment_date).toISOString().split('T')[0] :
        new Date().toISOString().split('T')[0];

      if (!collectionTrends[date]) {
        collectionTrends[date] = 0;
      }
      collectionTrends[date] += Number(payment.amount_paid || 0);
    });

    return {
      totalCollections,
      collectionEfficiency: totalCollections > 0 ? 100 : 0, // Simplificado
      collectionTrends,
      collectionsDetails: rawResults.map(row => ({
        credit_id: row.credit_id,
        client_id: row.client_id,
        client_name: row.client_name,
        amount_paid: Number(row.amount_paid || 0),
        payment_date: row.payment_date,
      })),
      collectionsCount: rawResults.length,
    };
  }

  // ==================== EXPORTACIÓN A EXCEL ====================

  async exportSalesToExcel(reportData: any, filters: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Ventas');

    // Configurar encabezados
    worksheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Producto', key: 'producto', width: 20 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Monto', key: 'monto', width: 15 },
    ];

    // Agregar información del filtro
    worksheet.addRow(['Reporte de Ventas']);
    worksheet.addRow([`Período: ${filters.startDate} - ${filters.endDate}`]);
    worksheet.addRow([]);

    // Agregar resumen
    worksheet.addRow(['RESUMEN']);
    worksheet.addRow(['Total de Ventas:', reportData.totalSales || 0]);
    worksheet.addRow(['Cantidad Total:', reportData.totalQuantity || 0]);
    worksheet.addRow(['Promedio por Transacción:', reportData.averageTransaction || 0]);
    worksheet.addRow(['Número de Ventas:', reportData.salesCount || 0]);
    worksheet.addRow([]);

    // Agregar datos de timeline si existen
    if (reportData.timelineData) {
      worksheet.addRow(['VENTAS POR DÍA']);
      worksheet.addRow(['Fecha', 'Ventas', 'Cantidad']);

      Object.entries(reportData.timelineData).forEach(([date, data]: [string, any]) => {
        worksheet.addRow([date, data.sales, data.quantity]);
      });
      worksheet.addRow([]);
    }

    // Agregar datos por producto si existen
    if (reportData.salesByProduct) {
      worksheet.addRow(['VENTAS POR PRODUCTO']);
      worksheet.addRow(['Producto', 'Cantidad', 'Monto']);

      Object.entries(reportData.salesByProduct).forEach(([product, data]: [string, any]) => {
        worksheet.addRow([product, data.quantity, data.amount]);
      });
      worksheet.addRow([]);
    }

    // Agregar datos por método de pago si existen
    if (reportData.salesByPaymentMethod) {
      worksheet.addRow(['VENTAS POR MÉTODO DE PAGO']);
      worksheet.addRow(['Método de Pago', 'Monto']);

      Object.entries(reportData.salesByPaymentMethod).forEach(([method, amount]: [string, any]) => {
        worksheet.addRow([method, amount]);
      });
    }

    // Aplicar estilos
    worksheet.getRow(1).font = { bold: true, size: 16 };
    worksheet.getRow(4).font = { bold: true };

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ==================== MÉTODOS DE EXPORTACIÓN ====================

  async exportAggregationToExcel(opts: {
    rows: any[];
    title: string;
    columns: ColumnDef[];
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Reporte');

    // Título
    ws.mergeCells('A1', String.fromCharCode(64 + opts.columns.length) + '1');
    ws.getCell('A1').value = opts.title;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getRow(2).values = opts.columns.map(c => c.header);
    ws.getRow(2).font = { bold: true };

    // Filas
    const rows = opts.rows.map(r => {
      const obj: Record<string, any> = {};
      for (const c of opts.columns) {
        let val = r[c.key];
        if (c.key === 'bucket' && val) val = this.formatDateLima(val);
        if (c.currency) val = Number(val ?? 0);
        obj[c.key] = val ?? '';
      }
      return obj;
    });

    ws.addRows(rows);

    // Estilos y formatos
    opts.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.width) col.width = c.width;
      if (c.currency) col.numFmt = '#,##0.00';
    });
    ws.autoFilter = { from: 'A2', to: { row: 2, column: opts.columns.length } };
    ws.columns.forEach(c => { if (!c.width) c.width = 18; });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportAggregationToPDF(opts: {
    rows: any[];
    title: string;
    columns: ColumnDef[];
    landscape?: boolean;
  }): Promise<Buffer> {
    // Fuentes mínimas (usa Roboto embebido o cualquiera en tu proyecto)
    const fonts = {
      Roboto: {
        normal: Buffer.from([]),
        bold: Buffer.from([]),
        italics: Buffer.from([]),
        bolditalics: Buffer.from([]),
      },
    };
    const printer = new PdfPrinter(fonts);

    const body: TableCell[][] = [];
    // Encabezados
    body.push(opts.columns.map(c => ({ text: c.header, bold: true })) as TableCell[]);

    // Filas
    for (const r of opts.rows) {
      const row: TableCell[] = [];
      for (const c of opts.columns) {
        let val: any = r[c.key];
        if (c.key === 'bucket' && val) val = this.formatDateLima(val);
        if (c.currency) val = Number(val ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 });
        row.push({ text: val ?? '' });
      }
      body.push(row);
    }

    const dd: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: opts.landscape ? 'landscape' : 'portrait',
      content: [
        { text: opts.title, bold: true, fontSize: 14, margin: [0, 0, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: opts.columns.map(() => 'auto'),
            body,
          },
          layout: 'lightHorizontalLines',
        },
        {
          margin: [0, 10, 0, 0],
          columns: [
            { text: `Filas: ${opts.rows.length}`, alignment: 'left' },
            { text: `Generado: ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`, alignment: 'right' },
          ]
        }
      ],
      defaultStyle: { font: 'Roboto', fontSize: 10 },
    };

    return await new Promise<Buffer>((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(dd);
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (c) => chunks.push(c));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }
}
