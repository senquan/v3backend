import { Repository, Like } from 'typeorm';
import { InterestRate } from '../models/interest-rate.entity';

export class InterestRateService {
  constructor(
    private interestRateRepository: Repository<InterestRate>,
  ) {}

  async findAll(query: any) {
    const { page = 1, size = 10, rateType, rateCode, status, currency, term } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    const queryBuilder = this.interestRateRepository.createQueryBuilder('interestRate')
      .leftJoin('interestRate.creator', 'creator')
      .leftJoin('interestRate.updater', 'updater')
      .addSelect('creator.name')
      .addSelect('updater.name')
      .where('1=1');

    if (rateType) {
      queryBuilder.andWhere('interestRate.rateType = :rateType', { rateType: parseInt(rateType as string) });
    }
    if (rateCode) {
      queryBuilder.andWhere('interestRate.rateCode LIKE :rateCode', { rateCode: `%${rateCode}%` });
    }
    if (status !== undefined && status !== '') {
      queryBuilder.andWhere('interestRate.status = :status', { status: parseInt(status as string) });
    }
    if (currency) {
      queryBuilder.andWhere('interestRate.currency = :currency', { currency });
    }
    if (term !== undefined && term !== '') {
      queryBuilder.andWhere('interestRate.term = :term', { term: parseInt(term as string) });
    }

    queryBuilder.orderBy('interestRate.status', 'ASC')
      .addOrderBy('interestRate.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [records, total] = await queryBuilder.getManyAndCount();

    return {
      records,
      total,
      page: pageNum,
      size: pageSize
    };
  }

  async findOne(id: number) {
    return await this.interestRateRepository.createQueryBuilder('interestRate')
      .leftJoin('interestRate.creator', 'creator')
      .leftJoin('interestRate.updater', 'updater')
      .addSelect('creator.name')
      .addSelect('updater.name')
      .where('interestRate.id = :id', { id })
      .getOne();
  }

  async findByCode(rateCode: string) {
    return await this.interestRateRepository.findOne({ where: { rateCode } });
  }

  async findActiveByType(rateType: number) {
    return await this.interestRateRepository.findOne({
      where: { rateType, status: 1 }
    });
  }

  async findByType(rateType: number) {
    return await this.interestRateRepository.find({
      where: { rateType, status: 1 },
      order: { term: 'ASC' }
    });
  }

  async create(data: Partial<InterestRate>, userId: number) {
    if (data.status === 1) {
      const existingActive = await this.findActiveByType(data.rateType!);
      if (existingActive) {
        throw new Error('该类型已存在生效状态的利率，请先修改原记录');
      }
    }

    const interestRate = this.interestRateRepository.create({
      ...data,
      createdBy: userId,
      updatedBy: userId
    });

    return await this.interestRateRepository.save(interestRate);
  }

  async confirmUpdate(id: number, rateValue: number, newRateCode: string, remark: string, userId: number) {
    const interestRate = await this.findOne(id);
    if (!interestRate) {
      throw new Error('利率不存在');
    }

    if (interestRate.status !== 1) {
      throw new Error('只能确认修改生效状态的利率');
    }

    await this.interestRateRepository.update(id, {
      status: 2,
      expiryDate: new Date(),
      updatedBy: userId
    });

    const newRate = this.interestRateRepository.create({
      rateType: interestRate.rateType,
      rateCode: newRateCode,
      rateValue: rateValue,
      effectiveDate: new Date(),
      expiryDate: null,
      status: 1,
      currency: interestRate.currency,
      term: interestRate.term,
      remark,
      createdBy: userId,
      updatedBy: userId
    });

    return await this.interestRateRepository.save(newRate);
  }

  async remove(id: number) {
    const interestRate = await this.findOne(id);
    if (!interestRate) {
      throw new Error('利率不存在');
    }

    if (interestRate.status === 1) {
      throw new Error('生效状态的利率不能删除');
    }

    await this.interestRateRepository.delete(id);
    return { message: '删除成功' };
  }
}
