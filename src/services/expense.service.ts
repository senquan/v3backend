import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvanceExpense } from '../models/advance-expense.entity';
import { CreateExpenseDto, UpdateExpenseDto } from '../dtos/expense.dto';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(AdvanceExpense)
    private expenseRepository: Repository<AdvanceExpense>,
  ) {}

  async findAll(query: any) {
    const { page = 1, size = 10, ...filters } = query;
    const skip = (page - 1) * size;
    
    const [items, total] = await this.expenseRepository.findAndCount({
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
    return await this.expenseRepository.findOne({ where: { id } });
  }

  async create(createExpenseDto: CreateExpenseDto) {
    const expense = this.expenseRepository.create({
      ...createExpenseDto,
      createdAt: new Date()
    });
    return await this.expenseRepository.save(expense);
  }

  async update(id: number, updateExpenseDto: UpdateExpenseDto) {
    await this.expenseRepository.update(id, updateExpenseDto);
    return await this.findOne(id);
  }

  async remove(id: number) {
    return await this.expenseRepository.delete(id);
  }

  async getSummary(query: any) {
    const { companyId, businessYear } = query;
    const summary = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'totalAmount')
      .addSelect('COUNT(expense.id)', 'expenseCount')
      .where('expense.companyId = :companyId', { companyId })
      .andWhere('expense.businessYear = :businessYear', { businessYear })
      .groupBy('expense.expenseType')
      .getRawMany();

    return summary;
  }
}