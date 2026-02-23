import { Repository } from 'typeorm';
import { DepositLoanSummary } from '../models/deposit-loan-summary.entity';

export class DepositLoanSummaryService {
  constructor(
    private depositLoanSummaryRepository: Repository<DepositLoanSummary>,
  ) {}

  async findAll(query: any) {
    const { page = 1, size = 10, companyId } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    const queryBuilder = this.depositLoanSummaryRepository.createQueryBuilder('summary')
      .leftJoin('summary.company', 'company')
      .addSelect('company.companyCode')
      .addSelect('company.companyName')
      .where('1=1');

    if (companyId) {
      queryBuilder.andWhere('summary.companyId = :companyId', { companyId: parseInt(companyId as string) });
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
    return await this.depositLoanSummaryRepository.createQueryBuilder('summary')
      .leftJoin('summary.company', 'company')
      .addSelect('company.companyCode')
      .addSelect('company.companyName')
      .where('summary.id = :id', { id })
      .getOne();
  }

  async findByCompanyId(companyId: number) {
    return await this.depositLoanSummaryRepository.findOne({
      where: { companyId }
    });
  }
}
