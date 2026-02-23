import { Response } from 'express';
import { AdvanceExpense } from '../models/advance-expense.entity';
import { AdvanceExpenseType } from '../models/advance-expense-type.entity';
import { AdvanceExpenseDetail } from '../models/advance-expense-detail.entity';
import { Dict } from '../models/dict.entity';
import { AppDataSource } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { In } from 'typeorm';
import { RedisCacheService } from '../services/cache.service';
import { DictService } from '../services/dict.service';

export class AdvanceExpenseController {
  private advanceExpenseRepository = AppDataSource.getRepository(AdvanceExpense);
  private dictRepository = AppDataSource.getRepository(Dict);
  private dictService = new DictService(this.dictRepository, new RedisCacheService());

  async createExpense(req: any, res: Response) {
    try {
      const {
        advanceCode,
        companyId,
        companyName,
        expenseType,
        amount,
        remark,
        businessYear
      } = req.body;

      if (!companyName) {
        return errorResponse(res, 400, '单位名称不能为空');
      }
      if (!amount || parseFloat(amount) <= 0) {
        return errorResponse(res, 400, '金额必须大于0');
      }
      if (!expenseType) {
        return errorResponse(res, 400, '费用类型不能为空');
      }
      if (!businessYear) {
        return errorResponse(res, 400, '业务年份不能为空');
      }

      const userId = (req as any).user?.id || 'admin';

      const expense = new AdvanceExpense();
      expense.advanceCode = advanceCode || this.generateAdvanceCode();
      expense.companyId = companyId ? parseInt(companyId) : 0;
      expense.companyName = companyName;
      expense.expenseType = parseInt(expenseType);
      expense.amount = parseFloat(amount);
      expense.remark = remark || null;
      expense.businessYear = parseInt(businessYear);
      expense.status = 1;
      expense.createdBy = userId;
      expense.updatedBy = userId;

      const saved = await this.advanceExpenseRepository.save(expense);
      return successResponse(res, saved, '创建成功');
    } catch (error) {
      return errorResponse(res, 500, `创建失败: ${error}`);
    }
  }

  async updateExpense(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const record = await this.advanceExpenseRepository.findOne({ where: { id } });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      const {
        companyName,
        expenseType,
        amount,
        remark,
        businessYear,
        status
      } = req.body;

      if (companyName !== undefined) record.companyName = companyName;
      if (expenseType !== undefined) record.expenseType = parseInt(expenseType);
      if (amount !== undefined) record.amount = parseFloat(amount);
      if (remark !== undefined) record.remark = remark || null;
      if (businessYear !== undefined) record.businessYear = parseInt(businessYear);
      if (status !== undefined) record.status = parseInt(status);

      const userId = (req as any).user?.id || 'admin';
      record.updatedBy = userId;

      const updated = await this.advanceExpenseRepository.save(record);
      return successResponse(res, updated, '更新成功');
    } catch (error) {
      return errorResponse(res, 500, `更新失败: ${error}`);
    }
  }

  async getExpenseList(req: any, res: Response) {
    try {
      const {
        keyword,
        type,
        status,
        page = 1,
        size = 10
      } = req.query;

      const pageNum = parseInt(page as string);
      const pageSize = parseInt(size as string);
      const skip = (pageNum - 1) * pageSize;

      let queryBuilder = this.advanceExpenseRepository.createQueryBuilder('expense');

      if (keyword) {
        queryBuilder = queryBuilder.andWhere('expense.companyName LIKE :keyword', { keyword: `%${keyword}%` });
      }
      if (status && status > 0) {
        queryBuilder = queryBuilder.andWhere('expense.status = :status', { status: parseInt(status as string) });
      } else {
        queryBuilder = queryBuilder.andWhere('expense.status != 3');
      }
      if (type && type > 0) {
        queryBuilder = queryBuilder.andWhere('expense.expenseType = :type', { type: parseInt(type as string) });
      }

      const [records, total] = await queryBuilder
        .innerJoinAndSelect('expense.creator', 'creator')
        .innerJoinAndSelect('expense.updater', 'updater')
        .leftJoinAndSelect('expense.details', 'details')
        .leftJoinAndSelect('details.expenseType', 'expenseType')
        .select(['expense', 'creator.name', 'updater.name', 'details', 'expenseType'])
        .orderBy('expense.createdAt', 'DESC')
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      return successResponse(res, { records, total }, '查询成功');
    } catch (error) {
      return errorResponse(res, 500, `查询失败: ${error}`);
    }
  }

  async getExpenseTypeList(req: any, res: Response) {
    try {
      const records = await this.dictService.findByGroup(2);
      return successResponse(res, { records, total: records.length }, '查询成功');
    } catch (error) {
      return errorResponse(res, 500, `查询失败: ${error}`);
    }
  }

  async deleteExpense(req: any, res: Response) {
    try {
      const { id } = req.body;

      const idNum = parseInt(id);
      const record = await this.advanceExpenseRepository.findOne({ where: { id: idNum } });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      record.status = 3;
      await this.advanceExpenseRepository.save(record);

      return successResponse(res, null, '删除成功');
    } catch (error) {
      return errorResponse(res, 500, `删除失败: ${error}`);
    }
  }

  async confirmExpense(req: any, res: Response) {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要确认的记录');
      }

      const numIds = ids.map((id: string | number) => parseInt(id as string));

      const result = await this.advanceExpenseRepository.update(
        { id: In(numIds), status: 1 },
        { status: 2 }
      );

      return successResponse(res, { affected: result.affected }, `确认成功，共确认 ${result.affected} 条记录`);
    } catch (error) {
      return errorResponse(res, 500, `确认失败: ${error}`);
    }
  }

  async batchImport(req: any, res: Response) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { expenses, batchNo, businessYear } = req.body;
      const userId = (req as any).user?.id || 'admin';

      if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
        await queryRunner.rollbackTransaction();
        return errorResponse(res, 400, '导入数据不能为空');
      }

      const year = businessYear || new Date().getFullYear();
      const currentBatchNo = batchNo || `AE${Date.now()}`;

      const dictTypes = await this.dictService.findByGroup(2);
      const typeNameToId: Map<string, number> = new Map();
      dictTypes.forEach(dict => {
        typeNameToId.set(dict.name, dict.id);
      });

      // 代垫费用细目类型
      const expenseDetailType = await queryRunner.manager.find(AdvanceExpenseType, {
        where: { status: 2 }
      });
      const detailTypeNameToId: Map<string, number> = new Map();
      expenseDetailType.forEach(type => {
        detailTypeNameToId.set(type.name, type.id);
      });

      for (let i = 0; i < expenses.length; i++) {
        const item = expenses[i];
        if (!item.companyName) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 400, `第${i + 1}行：单位名称不能为空`);
        }
        if (!item.expenseType) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 400, `第${i + 1}行：费用类型不能为空`);
        }

        let expenseTypeId = typeNameToId.get(item.expenseType);
        if (!expenseTypeId) {
          const newDict = await this.dictService.create({
            name: item.expenseType,
            value: item.expenseType,
            group: 2,
            remark: `${batchNo} 批量导入创建`
          });
          expenseTypeId = newDict.id;
          typeNameToId.set(item.expenseType, expenseTypeId);
        }

        const expense = new AdvanceExpense();
        expense.batchNo = currentBatchNo;
        expense.advanceCode = item.advanceCode || this.generateAdvanceCode();
        expense.companyId = item.companyId ? parseInt(item.companyId) : 0;
        expense.companyName = item.companyName;
        expense.expenseType = expenseTypeId;
        expense.amount = parseFloat(item.amount);
        expense.remark = item.remark || null;
        expense.businessYear = item.businessYear || year;
        expense.status = 1;
        expense.createdBy = userId;
        expense.updatedBy = userId;

        const savedExpense = await queryRunner.manager.save(expense);

        // 创建代垫费用明细
        if (item.details && item.details.length > 0) {

          let sum = 0;
          for (let j = 0; j < item.details.length; j++) {
            const detailItem = item.details[j];
            for (const key in detailItem) {
              let expenseDetailTypeId = detailTypeNameToId.get(key);
              if (!expenseDetailTypeId) {
                const newType = await queryRunner.manager.save(AdvanceExpenseType, {
                  name: key,
                  status: 2,
                  remark: `${batchNo} 批量导入创建`,
                  createdBy: userId,
                  createdAt: new Date()
                })
                expenseDetailTypeId = newType.id;
                detailTypeNameToId.set(key, expenseDetailTypeId);
              }
              const detail = new AdvanceExpenseDetail();
              detail.expenseId = savedExpense.id;
              detail.expenseTypeId = expenseDetailTypeId;
              detail.amount = parseFloat(detailItem[key] || '0');
              sum += detail.amount;
              await queryRunner.manager.save(AdvanceExpenseDetail, detail);
            }
          }
          const sumFixed = parseFloat(sum.toFixed(2));
          if (sumFixed !== Number(expense.amount)) {
            await queryRunner.rollbackTransaction();
            return errorResponse(res, 400, `第${i + 1}行：明细金额之和与总金额不一致 ${sumFixed} ${expense.amount}`);
          }
        }
      }

      await queryRunner.commitTransaction();

      return successResponse(res, {
        success: true,
        total: expenses.length,
        batchNo: currentBatchNo
      }, '导入成功');
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 500, `导入失败: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async getSummary(req: any, res: Response) {
    try {
      const { businessYear, companyId } = req.query;

      let queryBuilder = this.advanceExpenseRepository.createQueryBuilder('expense')
        .select('SUM(expense.amount)', 'totalAmount')
        .addSelect('COUNT(expense.id)', 'expenseCount')
        .addSelect('expense.expenseType', 'expenseType')
        .where('expense.status != 3');

      if (businessYear) {
        queryBuilder = queryBuilder.andWhere('expense.businessYear = :businessYear', { businessYear: parseInt(businessYear as string) });
      }
      if (companyId) {
        queryBuilder = queryBuilder.andWhere('expense.companyId = :companyId', { companyId: parseInt(companyId as string) });
      }

      const summary = await queryBuilder
        .groupBy('expense.expenseType')
        .getRawMany();

      const formattedSummary = summary.map(item => ({
        expenseType: item.expenseType,
        expenseTypeName: item.expenseType == 1 ? '利息' : '其他',
        totalAmount: parseFloat(item.totalAmount) || 0,
        expenseCount: parseInt(item.expenseCount) || 0
      }));

      return successResponse(res, formattedSummary, '查询成功');
    } catch (error) {
      return errorResponse(res, 500, `查询失败: ${error}`);
    }
  }

  private generateAdvanceCode(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `AE${year}${month}${day}${random}`;
  }
}
