import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfitPayment } from '../models/profit-payment.entity';
import { CreatePaymentDto, UpdatePaymentDto } from '../dtos/payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(ProfitPayment)
    private paymentRepository: Repository<ProfitPayment>,
  ) {}

  async findAll(query: any) {
    const { page = 1, size = 10, ...filters } = query;
    const skip = (page - 1) * size;
    
    const [items, total] = await this.paymentRepository.findAndCount({
      where: filters,
      skip,
      take: size,
      order: { createdAt: 'DESC' }
    });

    return {
      items,
      total,
      page: parseInt(page),
      size: parseInt(size)
    };
  }

  async findOne(id: number) {
    return await this.paymentRepository.findOne({ where: { id } });
  }

  async create(createPaymentDto: CreatePaymentDto) {
    const payment = this.paymentRepository.create({
      ...createPaymentDto,
      createdAt: new Date()
    });
    return await this.paymentRepository.save(payment);
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto) {
    await this.paymentRepository.update(id, updatePaymentDto);
    return await this.findOne(id);
  }

  async remove(id: number) {
    return await this.paymentRepository.delete(id);
  }

  async getUnpaidSummary(query: any) {
    const { companyId, businessYear } = query;
    const summary = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.plannedAmount - payment.actualAmount)', 'unpaidAmount')
      .addSelect('COUNT(payment.id)', 'paymentCount')
      .where('payment.companyId = :companyId', { companyId })
      .andWhere('payment.businessYear = :businessYear', { businessYear })
      .getRawOne();

    return summary;
  }
}