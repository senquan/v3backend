import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Category } from '../models/entities/Category.entity';
import { Matrix } from '../models/entities/Matrix.entity';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class MatrixController {
  // 获取岗位安全培训矩阵列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, category_id, format = "" } = req.query;
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(Matrix)
        .createQueryBuilder('matrix')
        .leftJoinAndSelect('matrix.creatorEntity', 'creator')
        .leftJoinAndSelect('matrix.category', 'category');
      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere('matrix.standard LIKE :keyword OR category.name LIKE :keyword ', { keyword: `%${keyword}%` });
      }

      if (category_id) {
        queryBuilder.andWhere('matrix.category_id = :category_id', { category_id });
      }

      if (format === 'opt') {
        // 查询所有矩阵项
        const matrices = await queryBuilder.getMany();
        const options = matrices.map(matrix => ({
          id: matrix._id,
          ref: matrix.ref,
          standard: matrix.standard,
          category_id: matrix.category_id
        }));
        return successResponse(res, {
          matrices: options
        }, '获取岗位安全培训矩阵列表成功');
      } else {
        // 计算分页
        const pageNum = Number(page);
        const pageSizeNum = Number(pageSize);
        const skip = (pageNum - 1) * pageSizeNum;
        
        // 获取总数和分页数据
        const [matrices, total] = await queryBuilder
          .orderBy('matrix._id', 'ASC')
          .skip(skip)
          .take(pageSizeNum)
          .getManyAndCount();

        // 获取三级分类名称
        const categoryNameMap: Record<number, string[]> = {};
        if (matrices.length > 0) {
          const categoryIds = matrices.map(matrix => matrix.category_id);
          const categoryNames = await AppDataSource.getRepository(Category)
           .createQueryBuilder('category')
           .leftJoinAndSelect('category.parent', 'parent')
           .leftJoinAndSelect('parent.parent', 'grandparent')
           .where('category._id IN (:...categoryIds)', { categoryIds })
           .getMany();
  
          // 构建分类名称映射
          categoryNames.forEach(category => {
            if (!categoryNameMap[category._id]) {
              categoryNameMap[category._id] = [];
            }
            if (category.parent?.parent) {
              const l1 = category.parent.parent.name || "";
              const l1ref = category.parent.parent.ref || "";
              const l1Level = Number(category.parent.parent.level) || 1;
              categoryNameMap[category._id][l1Level] = l1ref + " " + l1;
            }
            
            // 处理二级分类
            if (category.parent) {
              const l2 = category.parent.name || "";
              const l2ref = category.parent.ref || "";
              const l2Level = Number(category.parent.level) || 2;
              categoryNameMap[category._id][l2Level] = l2ref + " " + l2;
            }
            
            // 处理三级分类
            const l3 = category.name || "";
            const l3ref = category.ref || "";
            const l3Level = Number(category.level) || 3;
            categoryNameMap[category._id][l3Level] = l3ref + " " + l3;
          });
        }
        const formattedData = matrices.map(matrix => {
          const categoryId = matrix.category_id || 0;
          return {
            ...matrix,
            level1: categoryNameMap[categoryId]?.[1] || "",
            level2: categoryNameMap[categoryId]?.[2] || "",
            level3: categoryNameMap[categoryId]?.[3] || ""
          }
        });
        
        return successResponse(res, {
          matrices: formattedData,
          total,
          page: pageNum,
          pageSize: pageSizeNum
        }, '获取岗位安全培训矩阵列表成功');
      }
    } catch (error) {
      logger.error('获取岗位安全培训矩阵列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取岗位安全培训矩阵详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const matrix = await AppDataSource.getRepository(Matrix)
        .createQueryBuilder('matrix')
        .leftJoinAndSelect('matrix.category', 'category')
        .where('matrix._id = :id', { id })
        .getOne();
      
      if (!matrix) {
        return errorResponse(res, 404, '岗位安全培训矩阵不存在', null);
      }
      
      return successResponse(res, matrix, '获取岗位安全培训矩阵详情成功');
    } catch (error) {
      logger.error('获取岗位安全培训矩阵详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 创建岗位安全培训矩阵
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { category_id, ref, standard, assessment_method } = req.body;
      
      if (!ref) {
        return errorResponse(res, 400, '编号不能为空', null);
      }
      
      // 检查编号是否已存在
      const matrixRepository = AppDataSource.getRepository(Matrix);
      const existingMatrix = await matrixRepository.findOne({
        where: { ref, category_id }
      });
      
      if (existingMatrix) {
        return errorResponse(res, 400, '编号已存在', null);
      }

      // 创建新岗位安全培训矩阵
      const matrix = new Matrix();
      matrix.ref = ref;
      matrix.standard = standard;
      matrix.assessment_method = assessment_method.length > 0 ? assessment_method.join(",") : null;
      matrix.category_id = category_id;
      matrix.creator = (req as any).user?.id || null;
      
      const savedMatrix = await matrixRepository.save(matrix);
      
      return successResponse(res, savedMatrix, '创建岗位安全培训矩阵成功');
    } catch (error) {
      logger.error('创建岗位安全培训矩阵失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 更新岗位安全培训矩阵
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { category_id, ref, standard, assessment_method } = req.body;
      
      if (!ref) {
        return errorResponse(res, 400, '编号不能为空', null);
      }
      
      const matrixRepository = AppDataSource.getRepository(Matrix);
      
      // 检查岗位安全培训矩阵是否存在
      const matrix = await matrixRepository.findOne({
        where: { _id: Number(id) },
        relations: ['category']
      });
      
      if (!matrix) {
        return errorResponse(res, 404, '岗位安全培训矩阵不存在', null);
      }
      
      // 检查编号是否重复
      if (ref !== matrix.ref) {
        const existingMatrix = await matrixRepository.findOne({
          where: { ref, category_id }
        });

        if (existingMatrix) {
          return errorResponse(res, 400, '编号已存在', null);
        }
      }

      // 更新岗位安全培训矩阵信息
      matrix.ref = ref;
      matrix.standard = standard;
      matrix.assessment_method = assessment_method ? assessment_method.join(",") : "";
      matrix.category_id = category_id;
      matrix.updater = (req as any).user?.id || null;
      matrix.update_time = new Date();
      
      const updatedMatrix = await matrixRepository.save(matrix);
      return successResponse(res, updatedMatrix, '更新岗位安全培训矩阵成功');
    } catch (error) {
      logger.error('更新岗位安全培训矩阵失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除岗位安全培训矩阵
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const matrixRepository = AppDataSource.getRepository(Matrix);
      
      // 检查岗位安全培训矩阵是否存在
      const matrix = await matrixRepository.findOne({
        where: { _id: Number(id) }
      });
      
      if (!matrix) {
        return errorResponse(res, 404, '岗位安全培训矩阵不存在', null);
      }
 
      // 删除岗位安全培训矩阵
      await matrixRepository.remove(matrix);
      
      return successResponse(res, null, '删除岗位安全培训矩阵成功');
    } catch (error) {
      logger.error('删除岗位安全培训矩阵失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}