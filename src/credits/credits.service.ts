import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { Credit } from './entities/credit.entity';
import { Payment } from '../payments/entities/payment.entity';

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(Credit)
    private creditsRepository: Repository<Credit>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private dataSource: DataSource,
  ) { }

  // Crear un crédito
  async create(createCreditDto: any): Promise<Credit> {
    const credit = this.creditsRepository.create({
      client_id: createCreditDto.client_id, // o solo ...createCreditDto si tiene todo
      sale_id: createCreditDto.sale_id,
      credit_amount: createCreditDto.credit_amount,
      amount_paid: 0,
      due_date: createCreditDto.due_date,
      status: 'pending',
      // ... cualquier otro campo necesario
    });

    return await this.creditsRepository.save(credit); // credit debe ser un objeto, NO array
  }

  // Obtener todos los créditos (con filtros si necesitas)
  async findAll(filters?: any): Promise<Credit[]> {
    const query = this.creditsRepository.createQueryBuilder('credit')
      .leftJoinAndSelect('credit.client', 'client')
      .leftJoinAndSelect('credit.sale', 'sale');
    if (filters?.status) {
      query.andWhere('credit.status = :status', { status: filters.status });
    }
    if (filters?.overdue) {
      query.andWhere('credit.due_date < :today AND credit.credit_amount > credit.amount_paid', {
        today: new Date(),
      });
    }
    return query.orderBy('credit.due_date', 'ASC').getMany();
  }

  // Obtener un crédito por ID
  async findOne(id: number): Promise<Credit> {
    const credit = await this.creditsRepository.findOne({
      where: { credit_id: id },
      relations: ['client', 'sale'],
    });
    if (!credit) {
      throw new NotFoundException(`Crédito ${id} no encontrado`);
    }
    return credit;
  }

  async addPayment(
    id: number,
    amount: number,
    reference?: string,
    payment_method_id?: number,
    user_id?: number,
  ): Promise<Credit> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const credit = await queryRunner.manager.findOne(Credit, { where: { credit_id: id } });

      if (!credit) {
        throw new NotFoundException(`Crédito ${id} no encontrado`);
      }

      const balance = credit.credit_amount - credit.amount_paid;
      if (amount > balance) {
        throw new BadRequestException(
          'El pago no puede ser mayor al saldo pendiente',
        );
      }

      const payment = queryRunner.manager.create(Payment, {
        amount,
        payment_method_id,
        credit_id: credit.credit_id,
        payment_type: 'credit',
        status: 'completed',
        user_id,
      });
      await queryRunner.manager.save(Payment, payment);

      credit.amount_paid += amount;
      await queryRunner.manager.save(Credit, credit);

      await queryRunner.commitTransaction();
      return credit;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }


  // Créditos vencidos
  async getOverdueCredits(): Promise<Credit[]> {
    return this.creditsRepository.find({
      where: {
        due_date: LessThan(new Date()),
        status: 'pending',
      },
      relations: ['client', 'sale'],
    });
  }

  // Dashboard resumen
  async getCreditsDashboard(): Promise<any> {
    const [total, overdue, paid] = await Promise.all([
      this.creditsRepository.count({ where: { status: 'pending' } }),
      this.creditsRepository.count({
        where: {
          due_date: LessThan(new Date()),
          status: 'pending',
        },
      }),
      this.creditsRepository.count({ where: { status: 'paid' } }),
    ]);
    return { total, overdue, paid };
  }

  // Actualizar crédito
  async update(id: number, updateData: Partial<Credit>): Promise<Credit> {
    const credit = await this.findOne(id);
    Object.assign(credit, updateData);
    return this.creditsRepository.save(credit);
  }

  // Eliminar crédito
  async remove(id: number): Promise<void> {
    const result = await this.creditsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Credit with id ${id} not found`);
    }
  }
}
