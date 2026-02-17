import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternalDeposit } from '../models/internal-deposit.entity';
import { CreateDepositDto, UpdateDepositDto } from '../dtos/deposit.dto';

@Injectable()
export class DepositService {
  constructor(
    @InjectRepository(InternalDeposit)
    private depositRepository: Repository<InternalDeposit>,
  ) {}

  async findAll(query: any) {
    const { page = 1, size = 10, ...filters } = query;
    const skip = (page - 1) * size;
    
    const [items, total] = await this.depositRepository.findAndCount({
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
    return await this.depositRepository.findOne({ where: { id } });
  }

  async create(createDepositDto: CreateDepositDto) {
    const deposit = this.depositRepository.create({
      ...createDepositDto,
      createdAt: new Date()
    });
    return await this.depositRepository.save(deposit);
  }

  async update(id: number, updateDepositDto: UpdateDepositDto) {
    await this.depositRepository.update(id, updateDepositDto);
    return await this.findOne(id);
  }

  async remove(id: number) {
    return await this.depositRepository.delete(id);
  }

  async getStatistics(query: any) {
    const { companyId, yearNum } = query;
    const statistics = await this.depositRepository
      .createQueryBuilder('deposit')
      .select('SUM(deposit.balance)', 'totalBalance')
      .addSelect('AVG(deposit.interestRate)', 'avgInterestRate')
      .where('deposit.companyId = :companyId', { companyId })
      .andWhere('deposit.yearNum = :yearNum', { yearNum })
      .groupBy('deposit.depositType')
      .getRawMany();

    return statistics;
  }
}