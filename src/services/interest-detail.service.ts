import { Repository } from 'typeorm';
import { DailyCurrentInterestDetail } from '../models/current-interest-detail.entity';
import { DailyFixedInterestDetail } from '../models/fixed-interest-detail.entity';
import { FixedToCurrentInterestDetail } from '../models/f2c-interest-detail.entity';

export class InterestDetailService {
  constructor(
    private dailyInterestRepository: Repository<DailyCurrentInterestDetail>,
    private dailyFixedRepository: Repository<DailyFixedInterestDetail>,
    private fixedToCurrentRepository: Repository<FixedToCurrentInterestDetail>,
  ) {}

  async getDailyInterestAll(query: any) {
    const { page = 1, size = 10, companyId, startDate, endDate } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    const queryBuilder = this.dailyInterestRepository.createQueryBuilder('detail')
      .leftJoin('detail.company', 'company')
      .addSelect('company.companyCode')
      .addSelect('company.companyName')
      .where('1=1');

    if (companyId) {
      queryBuilder.andWhere('detail.companyId = :companyId', { companyId: parseInt(companyId as string) });
    }
    if (startDate) {
      queryBuilder.andWhere('detail.interestDate >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('detail.interestDate <= :endDate', { endDate });
    }

    queryBuilder.orderBy('detail.interestDate', 'DESC')
      .addOrderBy('detail.id', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [records, total] = await queryBuilder.getManyAndCount();

    return { records, total, page: pageNum, size: pageSize };
  }

  async getDailyFixedInterestAll(query: any) {
    const { page = 1, size = 10, companyId, depositCode, startDate, endDate, isEstimate } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    const queryBuilder = this.dailyFixedRepository.createQueryBuilder('detail')
      .leftJoin('detail.company', 'company')
      .addSelect('company.companyCode')
      .addSelect('company.companyName')
      .where('1=1');

    if (companyId) {
      queryBuilder.andWhere('detail.companyId = :companyId', { companyId: parseInt(companyId as string) });
    }
    if (depositCode) {
      queryBuilder.andWhere('detail.depositCode LIKE :depositCode', { depositCode: `%${depositCode}%` });
    }
    if (startDate) {
      queryBuilder.andWhere('detail.interestDate >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('detail.interestDate <= :endDate', { endDate });
    }
    if (isEstimate !== undefined && isEstimate !== '') {
      queryBuilder.andWhere('detail.isEstimate = :isEstimate', { isEstimate: parseInt(isEstimate as string) });
    }

    queryBuilder.orderBy('detail.interestDate', 'DESC')
      .addOrderBy('detail.id', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [records, total] = await queryBuilder.getManyAndCount();

    return { records, total, page: pageNum, size: pageSize };
  }

  async getFixedToCurrentInterestAll(query: any) {
    const { page = 1, size = 10, companyId, depositCode, startDate, endDate } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    const queryBuilder = this.fixedToCurrentRepository.createQueryBuilder('detail')
      .leftJoin('detail.company', 'company')
      .addSelect('company.companyCode')
      .addSelect('company.companyName')
      .where('1=1');

    if (companyId) {
      queryBuilder.andWhere('detail.companyId = :companyId', { companyId: parseInt(companyId as string) });
    }
    if (depositCode) {
      queryBuilder.andWhere('detail.depositCode LIKE :depositCode', { depositCode: `%${depositCode}%` });
    }
    if (startDate) {
      queryBuilder.andWhere('detail.interestReleaseDate >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('detail.interestReleaseDate <= :endDate', { endDate });
    }

    queryBuilder.orderBy('detail.interestReleaseDate', 'DESC')
      .addOrderBy('detail.id', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [records, total] = await queryBuilder.getManyAndCount();

    return { records, total, page: pageNum, size: pageSize };
  }
}
