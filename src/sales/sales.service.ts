import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Sale } from './entities/sale.entity';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { Nozzle } from '../nozzles/entities/nozzle.entity';

// NUEVO: resolver método de pago y crear créditos
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { Credit } from '../credits/entities/credit.entity';

export interface SaleFilters {
  startDate?: string;
  endDate?: string;
  clientId?: number;
  productId?: number;
  status?: string;
  paymentMethod?: string;
  employeeId?: number;
}

export interface DynamicPricing {
  basePrice: number;
  shiftMultiplier: number;
  timeMultiplier: number;
  finalPrice: number;
  appliedRules: string[];
}

/** Helper: extrae monto bruto desde notes: [pagado_bruto=20], [gross=20], [importe=20], [amount_paid=20] */
function parseGrossFromNotes(notes?: string): number | null {
  if (!notes) return null;
  const m = String(notes).match(
    /\b(?:pagado_bruto|pago_bruto|importe|gross|amount_paid)\s*=\s*(?:S\/\s*)?([0-9]+(?:\.[0-9]+)?)/i
  );
  return m ? Number(m[1]) : null;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(Nozzle)
    private nozzleRepository: Repository<Nozzle>,
    private dataSource: DataSource,
    private stockMovementsService: StockMovementsService,
  ) {}

  // Reglas de precios dinámicos
  private readonly pricingRules = {
    shifts: {
      morning:   { multiplier: 1.0,  description: 'Precio normal - turno mañana' },
      afternoon: { multiplier: 1.05, description: 'Precio +5% - turno tarde' },
      night:     { multiplier: 1.1,  description: 'Precio +10% - turno noche' },
      weekend:   { multiplier: 1.15, description: 'Precio +15% - fin de semana' },
    },
    timeRanges: {
      peak_hours:    { start: '18:00', end: '21:00', multiplier: 1.08, description: 'Precio +8% - horas pico' },
      early_morning: { start: '06:00', end: '08:00', multiplier: 0.95, description: 'Precio -5% - madrugada' },
    },
  };

  /** Normaliza el límite de “recientes” (default 25, min 1, max 100) */
  private normalizeRecentLimit(limit?: any, dft = 25, min = 1, max = 100): number {
    const n = Number(limit);
    if (!Number.isFinite(n) || n <= 0) return dft;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }

  /** Recientes por timestamp (DESC) */
  async findRecent(limit?: number) {
    const take = this.normalizeRecentLimit(limit);
    return this.salesRepository.find({
      order: { sale_timestamp: 'DESC' },
      take,
    });
  }

  async getAllSales() {
    return this.salesRepository.find({ order: { sale_id: 'DESC' } });
  }

  /** Alias para “recientes”, mantiene compatibilidad */
  async getRecentSales(limit?: number) {
    const take = this.normalizeRecentLimit(limit);
    return this.salesRepository.find({
      order: { sale_timestamp: 'DESC' },
      take,
    });
  }

  /**
   * Crea la venta y:
   *  - Si método = Crédito → crea deuda en `credits` (monto BRUTO si viene en notes)
   *  - Si NO es crédito → inserta pago en `payments` (monto BRUTO si viene en notes)
   */
  async create(createSaleDto: CreateSaleDto): Promise<Sale> {
    // Precios dinámicos si viene habilitado
    if ((createSaleDto as any).applyDynamicPricing) {
      const pricing = this.calculateDynamicPricing(
        Number(createSaleDto.total_amount || 0),
        (createSaleDto as any).shift,
        new Date()
      );
      createSaleDto.total_amount = pricing.finalPrice;
      (createSaleDto as any).final_amount =
        pricing.finalPrice - (Number((createSaleDto as any).discount_amount) || 0);
    }

    return await this.dataSource.transaction(async manager => {
      // 1) Resolver método de pago por id o por nombre
      let pm: PaymentMethod | null = null;

      if ((createSaleDto as any).payment_method_id) {
        pm = await manager.findOne(PaymentMethod, {
          where: { payment_method_id: (createSaleDto as any).payment_method_id },
        });
      }

      if (!pm && (createSaleDto as any).payment_method) {
        const raw = String((createSaleDto as any).payment_method).trim().toLowerCase();
        pm = await manager
          .createQueryBuilder(PaymentMethod, 'pm')
          .where('LOWER(pm.method_name) = :name', { name: raw })
          .getOne();
      }

      if (!pm) throw new BadRequestException('Método de pago inválido');

      // 2) Validar boquilla
      const nozzle = await manager.findOne(Nozzle, {
        where: { nozzle_id: (createSaleDto as any).nozzle_id },
      });
      if (!nozzle) throw new BadRequestException('Boquilla inválida');

      // 3) Montos (usa lo que viene del FE; si falta, calcula)
      const qty       = Number((createSaleDto as any).quantity ?? 0);
      const unitPrice = Number((createSaleDto as any).unit_price ?? 0);
      const discount  = Number((createSaleDto as any).discount_amount ?? 0);
      const totalNet  = Number((createSaleDto as any).total_amount ?? (unitPrice * qty));
      let finalAmount = Number((createSaleDto as any).final_amount ?? (totalNet - discount));
      if (!isFinite(finalAmount) || finalAmount <= 0) {
        throw new BadRequestException('Monto de venta inválido');
      }
      const total_amount = +totalNet.toFixed(2);
      finalAmount = +finalAmount.toFixed(2);

      // 4) Crear venta
      const sale = manager.create(Sale, {
        ...createSaleDto,
        payment_method_id: pm.payment_method_id,
        total_amount,
        final_amount: finalAmount,
        status: 'completed',
        sale_timestamp: new Date(),
        created_at: new Date(),
      } as any);
      await manager.save(sale);

      // Determinar monto BRUTO (con IGV) a partir de notes, si está presente
      const grossFromNotes = parseGrossFromNotes((createSaleDto as any).notes);
      const grossAmount =
        Number.isFinite(grossFromNotes as number)
          ? +(grossFromNotes as number).toFixed(2)
          : finalAmount; // fallback: neto si no se envió pagado_bruto

      // 5) ¿Es CRÉDITO? (robusto)
      const nameFromDto = String((createSaleDto as any).payment_method ?? '').trim().toLowerCase();
      const nameFromDb  = String(pm.method_name ?? '').trim().toLowerCase();
      const idFromDto   = Number((createSaleDto as any).payment_method_id);

      // Si el FE usa id=2 para Crédito, también entra
      const isCredit =
        ['credito', 'crédito', 'credit'].some(k => nameFromDto.includes(k) || nameFromDb.includes(k)) ||
        idFromDto === 2;

      if (isCredit) {
        if (!(sale as any).client_id) throw new BadRequestException('Crédito requiere cliente');

        const due =
          (createSaleDto as any).due_date
            ? new Date((createSaleDto as any).due_date)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 días

        const credit = manager.create(Credit, {
          client_id: (sale as any).client_id,
          sale_id:   (sale as any).sale_id,
          credit_amount: grossAmount, // ⬅️ BRUTO
          amount_paid: 0,
          status: 'pending',
          due_date: due,
        } as any);
        await manager.save(credit);
      } else {
        // 6) NO crédito → pago directo (monto BRUTO si está en notes)
        await manager.query(
          `
          INSERT INTO public.payments
            (user_id, sale_id, amount, payment_method_id, notes)
          VALUES
            ($1,      $2,      $3,     $4,               $5)
          `,
          [
            (createSaleDto as any).user_id ?? null,
            (sale as any).sale_id,
            grossAmount,                 // ⬅️ monto bruto (o neto si no vino en notes)
            pm.payment_method_id,
            'Pago automático',
          ]
        );
      }

      return sale;
    });
  }

  async findAll(filters?: SaleFilters): Promise<Sale[]> {
    const query = this.salesRepository.createQueryBuilder('sale')
      .leftJoinAndSelect('sale.client', 'client')
      .leftJoinAndSelect('sale.employee', 'employee');

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('sale.created_at BETWEEN :startDate AND :endDate', {
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate),
      });
    }
    if (filters?.clientId) {
      query.andWhere('sale.client_id = :clientId', { clientId: filters.clientId });
    }
    if (filters?.employeeId) {
      query.andWhere('sale.employee_id = :employeeId', { employeeId: filters.employeeId });
    }
    if (filters?.status) {
      query.andWhere('sale.status = :status', { status: filters.status });
    }
    if (filters?.paymentMethod) {
      query.andWhere('sale.payment_method_id = :paymentMethod', { paymentMethod: filters.paymentMethod });
    }
    if (filters?.productId) {
      query.leftJoin('sale_details', 'sd', 'sd.sale_id = sale.sale_id')
        .andWhere('sd.product_id = :productId', { productId: filters.productId });
    }

    return await query.orderBy('sale.created_at', 'DESC').getMany();
  }

  async findOne(id: number): Promise<Sale | null> {
    return await this.salesRepository.findOne({
      where: { sale_id: id },
      relations: ['client', 'employee'],
    });
  }

  async update(id: number, updateSaleDto: UpdateSaleDto): Promise<Sale | null> {
    await this.salesRepository.update(id, updateSaleDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.salesRepository.delete(id);
  }

  // Historial filtrado de ventas
  async getSalesHistory(filters: SaleFilters): Promise<{
    sales: Sale[];
    summary: {
      totalSales: number;
      totalAmount: number;
      averageTicket: number;
      salesByStatus: { [status: string]: number };
      salesByPaymentMethod: { [method: string]: number };
    }
  }> {
    const sales = await this.findAll(filters);
    const totalSales = sales.length;
    const totalAmount = sales.reduce(
      (sum, sale) => sum + Number((sale as any).final_amount ?? (sale as any).total_amount ?? 0),
      0
    );
    const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

    const salesByStatus = sales.reduce((acc, sale) => {
      acc[sale.status] = (acc[sale.status] || 0) + 1;
      return acc;
    }, {} as { [status: string]: number });

    const salesByPaymentMethod = sales.reduce((acc, sale) => {
      const method = (sale as any).paymentMethod?.method_name || 'unknown';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as { [method: string]: number });

    return { sales, summary: { totalSales, totalAmount, averageTicket, salesByStatus, salesByPaymentMethod } };
  }

  // Anulación de venta
  async cancelSale(id: number, userId: number, reason: string, userRole: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (!sale) throw new NotFoundException(`Venta con ID ${id} no encontrada`);
    if (sale.status === 'cancelled') throw new BadRequestException('La venta ya está anulada');

    const canCancel = this.canCancelSale(sale, userRole, userId);
    if (!canCancel.allowed) throw new ForbiddenException(canCancel.reason);

    sale.status = 'cancelled';
    sale.notes = (sale.notes || '') + `\n[ANULADA] ${new Date().toISOString()} - Usuario: ${userId} - Motivo: ${reason}`;
    return await this.salesRepository.save(sale);
  }

  private canCancelSale(sale: Sale, userRole: string, userId: number): { allowed: boolean; reason?: string } {
    if (userRole === 'superadmin') return { allowed: true };

    if (userRole === 'admin') {
      const today = new Date();
      const saleDate = new Date(sale.created_at);
      const isToday = today.toDateString() === saleDate.toDateString();
      if (!isToday) return { allowed: false, reason: 'Los administradores solo pueden anular ventas del día actual' };
      return { allowed: true };
    }

    if (userRole === 'seller') {
      if ((sale as any).user_id !== userId) return { allowed: false, reason: 'Los vendedores solo pueden anular sus propias ventas' };
      const today = new Date();
      const saleDate = new Date(sale.created_at);
      const isToday = today.toDateString() === saleDate.toDateString();
      if (!isToday) return { allowed: false, reason: 'Los vendedores solo pueden anular ventas del día actual' };
      const hoursDiff = (today.getTime() - saleDate.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 2) return { allowed: false, reason: 'No se pueden anular ventas después de 2 horas' };
      return { allowed: true };
    }

    return { allowed: false, reason: 'Sin permisos para anular ventas' };
  }

  // Precios dinámicos
  calculateDynamicPricing(basePrice: number, shift?: string, timestamp?: Date): DynamicPricing {
    let finalPrice = basePrice;
    let shiftMultiplier = 1.0;
    let timeMultiplier = 1.0;
    const appliedRules: string[] = [];

    const now = timestamp || new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    if (shift && (this.pricingRules.shifts as any)[shift]) {
      shiftMultiplier = (this.pricingRules.shifts as any)[shift].multiplier;
      appliedRules.push((this.pricingRules.shifts as any)[shift].description);
    }
    if (isWeekend) {
      shiftMultiplier = Math.max(shiftMultiplier, this.pricingRules.shifts.weekend.multiplier);
      appliedRules.push(this.pricingRules.shifts.weekend.description);
    }
    for (const [, rule] of Object.entries(this.pricingRules.timeRanges)) {
      if (this.isTimeInRange(currentTime, (rule as any).start, (rule as any).end)) {
        timeMultiplier = Math.max(timeMultiplier, (rule as any).multiplier);
        appliedRules.push((rule as any).description);
      }
    }

    finalPrice = basePrice * shiftMultiplier * timeMultiplier;

    return {
      basePrice,
      shiftMultiplier,
      timeMultiplier,
      finalPrice: Math.round(finalPrice * 100) / 100,
      appliedRules,
    };
  }

  private isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
    return currentTime >= startTime && currentTime <= endTime;
  }

  async getSalesByClient(clientId: number, filters?: Omit<SaleFilters, 'clientId'>): Promise<Sale[]> {
    return this.findAll({ ...filters, clientId });
  }

  async getSalesByEmployee(employeeId: number, filters?: Omit<SaleFilters, 'employeeId'>): Promise<Sale[]> {
    return this.findAll({ ...filters, employeeId });
  }

  async getSalesStats(filters?: SaleFilters): Promise<any> {
    const { sales, summary } = await this.getSalesHistory(filters ?? {});
    const salesByDay = sales.reduce((acc, sale) => {
      const day = new Date(sale.created_at).toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + Number((sale as any).final_amount ?? (sale as any).total_amount ?? 0);
      return acc;
    }, {} as { [day: string]: number });

    const salesByHour = sales.reduce((acc, sale) => {
      const hour = new Date(sale.created_at).getHours();
      acc[hour] = (acc[hour] || 0) + Number((sale as any).final_amount ?? (sale as any).total_amount ?? 0);
      return acc;
    }, {} as { [hour: number]: number });

    return { ...summary, salesByDay, salesByHour, topClients: await this.getTopClientsBySales(filters, 5) };
  }

  private async getTopClientsBySales(filters?: SaleFilters, limit: number = 10): Promise<any[]> {
    let query = `
      SELECT c.client_id, c.name, COUNT(s.sale_id) AS total_sales, SUM(s.final_amount) AS total_amount
      FROM clients c
      INNER JOIN sales s ON c.client_id = s.client_id
      WHERE 1=1
    `;
    const params: any = {};

    if (filters?.startDate && filters?.endDate) {
      query += ' AND s.created_at BETWEEN :startDate AND :endDate';
      params.startDate = new Date(filters.startDate);
      params.endDate = new Date(filters.endDate);
    }

    query += `
      GROUP BY c.client_id, c.name
      ORDER BY total_amount DESC
      LIMIT :limit
    `;
    params.limit = limit;

    return this.dataSource.query(query, params);
  }

  async getSalesReport(startDate?: string, endDate?: string): Promise<any> {
    const filters: SaleFilters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    return this.getSalesHistory(filters);
  }

  getPublicData() {
    return {
      message: 'Datos públicos de ventas',
      stats: { totalSales: 0, averageSale: 0 },
    };
  }
}
