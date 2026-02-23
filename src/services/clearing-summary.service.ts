import { Repository } from 'typeorm';
import { ClearingSummary } from '../models/clearing-summary.entity';

export class ClearingSummaryService {
  constructor(
    private clearingSummaryRepository: Repository<ClearingSummary>,
  ) {}

  async findAll(query: any) {
    const { page = 1, size = 10, keyword } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    const queryBuilder = this.clearingSummaryRepository.createQueryBuilder('summary')
      .innerJoin('summary.company', 'company')
      .addSelect('company.companyCode')
      .addSelect('company.companyName')
      .where('1=1');

    if (keyword) {
      queryBuilder.andWhere('(summary.companyCode LIKE :keyword OR company.companyName LIKE :keyword)', { keyword: `%${keyword}%` });
    }

    queryBuilder.orderBy('summary.sort', 'ASC')
      .addOrderBy('summary.lastStatDate', 'DESC')
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
    return await this.clearingSummaryRepository.createQueryBuilder('summary')
      .innerJoin('summary.company', 'company')
      .addSelect('company.companyCode')
      .addSelect('company.companyName')
      .where('summary.id = :id', { id })
      .getOne();
  }

  async findByCompanyId(companyId: number) {
    return await this.clearingSummaryRepository.findOne({
      where: { companyId }
    });
  }
}
