import { Response } from 'express';
import { CompanyInfo } from '../models/company-info.entity';
import { FundTransfer } from '../models/fund-transfer.entity';
import { AppDataSource } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { In } from 'typeorm';

export class FundTransferController {
  private fundTransferRepository = AppDataSource.getRepository(FundTransfer);

  async createTransfer(req: any, res: Response) {
    try {
      const {
        transferCode,
        companyId,
        transferAmount,
        transferType,
        transferDate,
        transferStatus,
        bankAccount,
        isLoan,
        dueDate,
        remark
      } = req.body;

      if (!companyId) {
        return errorResponse(res, 400, '单位编号不能为空');
      }
      if (!transferAmount || parseFloat(transferAmount) <= 0) {
        return errorResponse(res, 400, '转账金额必须大于0');
      }
      if (!transferType) {
        return errorResponse(res, 400, '转账类型不能为空');
      }
      if (!transferDate) {
        return errorResponse(res, 400, '转账日期不能为空');
      }

      const userId = (req as any).user?.id || 'admin';

      const transfer = new FundTransfer();
      transfer.transferCode = transferCode || this.generateTransferCode();
      transfer.companyId = companyId;
      transfer.transferAmount = parseFloat(transferAmount);
      transfer.transferType = parseInt(transferType);
      transfer.transferDate = new Date(transferDate);
      transfer.transferStatus = transferStatus ? parseInt(transferStatus) : 1;
      transfer.bankAccount = bankAccount || null;
      transfer.isLoan = isLoan ? parseInt(isLoan) : 0;
      transfer.dueDate = dueDate ? new Date(dueDate) : null;
      transfer.remark = remark || null;
      transfer.createdBy = userId;
      transfer.updatedBy = userId;

      const saved = await this.fundTransferRepository.save(transfer);
      return successResponse(res, saved, '创建成功');
    } catch (error) {
      return errorResponse(res, 500, `创建失败: ${error}`);
    }
  }

  async updateTransfer(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const record = await this.fundTransferRepository.findOne({ where: { id } });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      const {
        transferAmount,
        transferType,
        transferDate,
        transferStatus,
        bankAccount,
        isLoan,
        dueDate,
        remark
      } = req.body;

      if (transferAmount !== undefined) record.transferAmount = parseFloat(transferAmount);
      if (transferType !== undefined) record.transferType = parseInt(transferType);
      if (transferDate !== undefined) record.transferDate = new Date(transferDate);
      if (transferStatus !== undefined) record.transferStatus = parseInt(transferStatus);
      if (bankAccount !== undefined) record.bankAccount = bankAccount || null;
      if (isLoan !== undefined) record.isLoan = parseInt(isLoan);
      if (dueDate !== undefined) record.dueDate = dueDate ? new Date(dueDate) : null;
      if (remark !== undefined) record.remark = remark || null;

      const userId = (req as any).user?.id || 'admin';
      record.updatedBy = userId;

      const updated = await this.fundTransferRepository.save(record);
      return successResponse(res, updated, '更新成功');
    } catch (error) {
      return errorResponse(res, 500, `更新失败: ${error}`);
    }
  }

  async getTransferList(req: any, res: Response) {
    try {
      const { 
        keyword,
        companyId,
        type, 
        transferStatus, 
        startDate, 
        endDate,
        isLoan,
        page = 1, 
        size = 10 
      } = req.query;

      const pageNum = parseInt(page as string);
      const pageSize = parseInt(size as string);
      const skip = (pageNum - 1) * pageSize;

      let queryBuilder = this.fundTransferRepository.createQueryBuilder('transfer');

      if (type && type > 0) {
        queryBuilder = queryBuilder.andWhere('transfer.transferType = :transferType', { transferType: parseInt(type as string) });
      }
      if (transferStatus && transferStatus > 0) {
        queryBuilder = queryBuilder.andWhere('transfer.transferStatus = :transferStatus', { transferStatus: parseInt(transferStatus as string) });
      }
      if (startDate) {
        queryBuilder = queryBuilder.andWhere('transfer.transferDate >= :startDate', { startDate: new Date(startDate as string) });
      }
      if (endDate) {
        queryBuilder = queryBuilder.andWhere('transfer.transferDate <= :endDate', { endDate: new Date(endDate as string) });
      }
      if (keyword) {
        queryBuilder = queryBuilder.andWhere('company.companyName LIKE :keyword', { keyword: `%${keyword}%` });
      }
      if (companyId) {
        queryBuilder = queryBuilder.andWhere('transfer.companyId = :companyId', { companyId: parseInt(companyId as string) });
      }
      if (isLoan) {
        queryBuilder = queryBuilder.andWhere('transfer.isLoan = :isLoan', { isLoan: parseInt(isLoan as string) });
      }

      const [items, total] = await queryBuilder
        .innerJoinAndSelect('transfer.company', 'company')
        .innerJoinAndSelect('transfer.creator', 'creator')
        .innerJoinAndSelect('transfer.updater', 'updater')
        .select(['transfer', 'company', 'creator.name', 'updater.name'])
        .orderBy('transfer.createdAt', 'DESC')
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      const records = items.map(record => ({
        ...record,
        transferAmount: parseFloat(record.transferAmount as any),
        transferDirection: record.transferType === 1 ? '上划' : '下拨'
      }));

      return successResponse(res, { records, total }, '查询成功');
    } catch (error) {
      return errorResponse(res, 500, `查询失败: ${error}`);
    }
  }

  async deleteTransfer(req: any, res: Response) {
    try {
      const { id } = req.body;
      
      const idNum = parseInt(id);
      const record = await this.fundTransferRepository.findOne({ where: { id: idNum } });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      await this.fundTransferRepository.remove(record);

      return successResponse(res, null, '删除成功');
    } catch (error) {
      return errorResponse(res, 500, `删除失败: ${error}`);
    }
  }

  async batchImport(req: any, res: Response) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { transfers, batchNo, transferType } = req.body;
      const userId = (req as any).user?.id || 'admin';

      if (!transfers || !Array.isArray(transfers) || transfers.length === 0) {
        await queryRunner.rollbackTransaction();
        return errorResponse(res, 400, '导入数据不能为空');
      }

      const type = parseInt(transferType) || 1;
      const currentBatchNo = batchNo || (type === 1 ? `UP${Date.now()}` : `DOWN${Date.now()}`);

      const companies = await queryRunner.manager.find(CompanyInfo, {
        where: { status: 1 }
      });
      const companyNameToId: Map<string, number> = new Map();
      companies.forEach(company => {
        companyNameToId.set(company.companyName, company.id);
      });

      for (let i = 0; i < transfers.length; i++) {
        const item = transfers[i];

        if (!item.companyName) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 400, `第${i + 1}行：单位名称不能为空`);
        }
        if (!companyNameToId.has(item.companyName)) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 400, `第${i + 1}行：单位名称 "${item.companyName}" 不存在于系统中`);
        }
        if (!item.transferAmount || parseFloat(item.transferAmount) <= 0) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 400, `第${i + 1}行：转账金额必须大于0`);
        }
        if (!item.transferDate) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 400, `第${i + 1}行：转账日期不能为空`);
        }

        const transfer = new FundTransfer();
        transfer.batchNo = currentBatchNo;
        transfer.transferCode = item.transferCode || this.generateTransferCode();
        transfer.companyId = companyNameToId.get(item.companyName) || 0;
        transfer.transferAmount = parseFloat(item.transferAmount);
        transfer.transferType = type;
        transfer.transferDate = new Date(item.transferDate);
        transfer.transferStatus = 1;
        transfer.bankAccount = item.bankAccount || null;
        transfer.isLoan = item.isLoan === "是" ? 1 : 0;
        transfer.dueDate = item.dueDate ? new Date(item.dueDate) : null;
        transfer.remark = item.remark || null;
        transfer.createdBy = userId;
        transfer.updatedBy = userId;

        await queryRunner.manager.save(transfer);
      }

      await queryRunner.commitTransaction();

      return successResponse(res, {
        success: true,
        total: transfers.length,
        batchNo: currentBatchNo
      }, '导入成功');
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 500, `导入失败: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async confirmTransfer(req: any, res: Response) {
    try {
      const type = parseInt(req.body.type) || 1;
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要确认的记录');
      }

      const numIds = ids.map((id: string | number) => parseInt(id as string));

      const result = await this.fundTransferRepository.update(
        { id: In(numIds), transferStatus: 1, transferType: type },
        { transferStatus: 2 }
      );

      return successResponse(res, { affected: result.affected }, `确认成功，共确认 ${result.affected} 条记录`);
    } catch (error) {
      return errorResponse(res, 500, `确认失败: ${error}`);
    }
  }

  private generateTransferCode(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `FT${year}${month}${day}${random}`;
  }
}
