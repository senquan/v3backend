import { Repository } from 'typeorm';
import { DailyCurrentInterestDetail } from '../models/current-interest-detail.entity';
import { DailyFixedInterestDetail } from '../models/fixed-interest-detail.entity';
import { FixedToCurrentInterestDetail } from '../models/f2c-interest-detail.entity';
import { FixedDepositLog } from '../models/fixed-deposit-log.entity';
import { AppDataSource } from '../config/database';

export class InterestDetailService {
  constructor(
    private dailyInterestRepository: Repository<DailyCurrentInterestDetail>,
    private dailyFixedRepository: Repository<DailyFixedInterestDetail>,
    private fixedToCurrentRepository: Repository<FixedToCurrentInterestDetail>,
  ) {}

  async getDailyInterest(query: any) {
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
    if (query.accessableCompanyIds) {
      queryBuilder.andWhere('detail.companyId IN (:...ids)', { ids: query.accessableCompanyIds });
    }

    queryBuilder.orderBy('detail.interestDate', 'DESC')
      .addOrderBy('detail.id', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [records, total] = await queryBuilder.getManyAndCount();

    return { records, total, page: pageNum, size: pageSize };
  }

  async getDailyInterestAll(query: any) {
    const { page = 1, size = 10, companyId, startDate, endDate } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);

    const schema = process.env.DB_SCHEMA || 'fms_dev';
    const params: any[] = [];
    const filters: string[] = [];
    const allowedCompanyIds = query.accessableCompanyIds || [];

    if (companyId && allowedCompanyIds.includes(companyId as string)) {
      params.push(parseInt(companyId as string));
      filters.push(`combined."companyId" = $${params.length}`);
    } else {
      return { records: [], total: 0, page: pageNum, size: pageSize };
    }
    if (startDate) {
      params.push(startDate);
      filters.push(`combined."interestDate" >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      filters.push(`combined."interestDate" <= $${params.length}`);
    }

    const whereClause = filters.length > 0 ? filters.join(' AND ') : '1=1';

    const unionSql = `
      (
        SELECT d.id, d."companyId", d."interestDate",
               NULL::text AS "remark",
               d."currentBalance",
               d."dailyRate",
               d."dailyInterest" AS "interestAmount"
        FROM ${schema}.daily_current_interest_detail d
      )
      UNION ALL
      (
        SELECT d.id, d."companyId", d."interestReleaseDate"::date AS "interestDate",
               ('定期提前释放合并活期计息：' || e."interestDays" || '天')::text AS "remark",
               d."releaseAmount" AS "currentBalance",
               d."dailyRate",
               d."interestAmount"
        FROM ${schema}.fixed_to_current_interest_detail d
        INNER JOIN ${schema}.fixed_deposit_log e ON d."fundLogId" = e.id
      )
    `;

    const pageSql = `SELECT * FROM (${unionSql}) AS combined WHERE ${whereClause} ORDER BY "interestDate" DESC, id ASC LIMIT ${pageSize} OFFSET ${(pageNum - 1) * pageSize}`;
    const records = await AppDataSource.manager.query(pageSql, params);

    const countSql = `SELECT COUNT(*) AS total FROM (${unionSql}) AS combined WHERE ${whereClause}`;
    const totalResult = await AppDataSource.manager.query(countSql, params);
    const total = parseInt(totalResult[0]['total'] || '0', 10);

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
    if (query.accessableCompanyIds) {
      queryBuilder.andWhere('detail.companyId IN (:...ids)', { ids: query.accessableCompanyIds });
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
    if (query.accessableCompanyIds) {
      queryBuilder.andWhere('detail.companyId IN (:...ids)', { ids: query.accessableCompanyIds });
    }

    queryBuilder.orderBy('detail.interestReleaseDate', 'DESC')
      .addOrderBy('detail.id', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [records, total] = await queryBuilder.getManyAndCount();

    return { records, total, page: pageNum, size: pageSize };
  }
}
