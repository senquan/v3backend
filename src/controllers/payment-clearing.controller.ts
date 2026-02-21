import { Response } from 'express';
import { PaymentReceive } from '../models/payment-receive.entity';
import { AppDataSource } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { In } from 'typeorm';

export class PaymentClearingController {
  private paymentReceiveRepository = AppDataSource.getRepository(PaymentReceive);

  async importPaymentReceive(req: any, res: Response) {
    try {
      const { receives, batchNo, receiveType } = req.body;
      const userId = (req as any).user?.id || 'admin';

      if (!receives || !Array.isArray(receives) || receives.length === 0) {
        return errorResponse(res, 400, '导入数据不能为空');
      }

      const type = parseInt(receiveType) || 1;
      const currentBatchNo = batchNo || (type === 1 ? `BANK${Date.now()}` : `BILL${Date.now()}`);
      const importedRecords: PaymentReceive[] = [];
      const errors: string[] = [];

      for (let i = 0; i < receives.length; i++) {
        const item = receives[i];

        if (!item.companyName) {
          errors.push(`第${i + 1}行：单位名称不能为空`);
          continue;
        }

        if (!item.receiveDate) {
          errors.push(`第${i + 1}行：到款日期不能为空`);
          continue;
        }

        const payment = new PaymentReceive();
        payment.receiveType = type;
        payment.receiveDate = new Date(item.receiveDate);
        payment.sapCode = item.sapCode || null;
        payment.companyName = item.companyName;
        payment.customerName = item.customerName || null;
        payment.projectName = item.projectName || null;
        payment.receiveBank = item.receiveBank || null;
        payment.billNo = item.billNo || null;
        payment.accountSet = item.accountSet || null;
        payment.status = 1;
        payment.createdBy = userId;
        payment.updatedBy = userId;
        payment.batchNo = currentBatchNo;

        if (type === 1) {
          if (!item.accountAmount || parseFloat(item.accountAmount) <= 0) {
            errors.push(`第${i + 1}行：到款金额必须大于0`);
            continue;
          }
          payment.accountAmount = parseFloat(item.accountAmount);
        } else {
          if (!item.billNo) {
            errors.push(`第${i + 1}行：票据号码不能为空`);
            continue;
          }
          if (!item.billAmount || parseFloat(item.billAmount) <= 0) {
            errors.push(`第${i + 1}行：票据金额必须大于0`);
            continue;
          }
          if (!item.dueDate) {
            errors.push(`第${i + 1}行：到期日不能为空`);
            continue;
          }

          payment.billNo = item.billNo;
          payment.billType = item.billType || '1';
          payment.billAmount = parseFloat(item.billAmount);
          payment.dueDate = new Date(item.dueDate);
          payment.collectionDate = item.collectionDate ? new Date(item.collectionDate) : null;
          payment.received = item.collectionDate ? 1 : 0;
          payment.discountDate = item.discountDate ? new Date(item.discountDate) : null;
          payment.discountAmount = parseFloat(item.discountAmount) || 0;
          payment.discountFee = parseFloat(item.discountFee) || 0;
          payment.accountAmount = payment.discountAmount > 0 ? payment.discountAmount : payment.billAmount;
        }

        try {
          const saved = await this.paymentReceiveRepository.save(payment);
          importedRecords.push(saved);
        } catch (saveError: any) {
          const errorMsg = saveError.message || '';
          if (errorMsg.includes('UQ_') || errorMsg.includes('unique') || errorMsg.includes('duplicate key')) {
            errors.push(`第${i + 1}行：数据已存在，请检查是否重复导入`);
          } else {
            errors.push(`第${i + 1}行：保存失败 - ${saveError.message}`);
          }
          continue;
        }
      }

      if (errors.length > 0 && importedRecords.length === 0) {
        return successResponse(res, {
          success: false,
          total: receives.length,
          successCount: 0,
          errorCount: errors.length,
          errors
        }, '导入失败', 400);
      }

      return successResponse(res, {
        success: true,
        total: receives.length,
        successCount: importedRecords.length,
        errorCount: errors.length,
        batchNo: currentBatchNo,
        importedRecords,
        errors: errors.length > 0 ? errors : undefined
      }, errors.length > 0 ? '部分数据导入成功' : '导入成功');
    } catch (error) {
      return errorResponse(res, 500, `导入失败: ${error}`);
    }
  }

  async getReceiveList(req: any, res: Response) {
    try {
      const { receiveType, companyName, status, batchNo, page = 1, size = 10 } = req.query;
      const pageNum = parseInt(page as string);
      const pageSize = parseInt(size as string);
      const skip = (pageNum - 1) * pageSize;

      let queryBuilder = this.paymentReceiveRepository.createQueryBuilder('receive');

      if (receiveType && receiveType > 0) {
        queryBuilder = queryBuilder.andWhere('receive.receiveType = :receiveType', { receiveType: parseInt(receiveType as string) });
      }
      if (companyName) {
        queryBuilder = queryBuilder.andWhere('receive.companyName LIKE :companyName', { companyName: `%${companyName}%` });
      }
      if (status && status > 0) {
        queryBuilder = queryBuilder.andWhere('receive.status = :status', { status: parseInt(status as string) });
      } else {
        queryBuilder = queryBuilder.andWhere('receive.status != 4');
      }
      if (batchNo) {
        queryBuilder = queryBuilder.andWhere('receive.batchNo = :batchNo', { batchNo });
      }

      const [records, total] = await queryBuilder
        .innerJoinAndSelect('receive.creator', 'creator')
        .innerJoinAndSelect('receive.updater', 'updater')
        .select(['receive', 'creator.name', 'updater.name'])
        .orderBy('receive.createdAt', 'DESC')
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      return successResponse(res, { records, total }, '查询成功');
    } catch (error) {
      return errorResponse(res, 500, `查询失败: ${error}`);
    }
  }

  async updateReceive(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const record = await this.paymentReceiveRepository.findOne({ where: { id } });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      const { 
        collectionDate, 
        discountDate, 
        discountAmount, 
        discountFee, 
        status,
        accountAmount 
      } = req.body;

      if (collectionDate !== undefined) {
        record.collectionDate = collectionDate ? new Date(collectionDate) : null;
        record.received = collectionDate ? 1 : 0;
      }

      if (discountDate !== undefined) {
        record.discountDate = discountDate ? new Date(discountDate) : null;
      }

      if (discountAmount !== undefined) {
        record.discountAmount = parseFloat(discountAmount) || 0;
        record.accountAmount = record.discountAmount > 0 ? record.discountAmount : record.billAmount;
      }

      if (discountFee !== undefined) {
        record.discountFee = parseFloat(discountFee) || 0;
      }

      if (accountAmount !== undefined) {
        record.accountAmount = parseFloat(accountAmount) || 0;
      }

      if (status !== undefined) {
        record.status = parseInt(status);
      }

      const updated = await this.paymentReceiveRepository.save(record);
      return successResponse(res, updated, '更新成功');
    } catch (error) {
      return errorResponse(res, 500, `更新失败: ${error}`);
    }
  }

  async confirmReceive(req: any, res: Response) {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要确认的记录');
      }

      const numIds = ids.map((id: string | number) => parseInt(id as string));
      
      const result = await this.paymentReceiveRepository.update(
        { id: In(numIds), status: 1 },
        { status: 2 }
      );

      return successResponse(res, { affected: result.affected }, `确认成功，共确认 ${result.affected} 条记录`);
    } catch (error) {
      return errorResponse(res, 500, `确认失败: ${error}`);
    }
  }

  async deleteReceive(req: any, res: Response) {
    try {
      const { id } = req.body;
      
      const idNum = parseInt(id);
      const record = await this.paymentReceiveRepository.findOne({ where: { id: idNum } });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      record.status = 4;
      await this.paymentReceiveRepository.save(record);

      return successResponse(res, null, '删除成功');
    } catch (error) {
      return errorResponse(res, 500, `删除失败: ${error}`);
    }
  }
}
