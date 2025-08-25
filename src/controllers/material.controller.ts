import { Request, Response } from 'express';
import { In } from 'typeorm'
import { AppDataSource } from '../config/database';
import { Material } from '../models/entities/Material.entity';
import { User } from '../models/entities/User.entity';
import { Courseware } from '../models/entities/Courseware.entity';
import { CoursewareMaterial } from '../models/entities/CoursewareMaterial.entity';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class MaterialController {
  // 获取培训资料列表
  async getList(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, pageSize = 10, title, fileType } = req.query;
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const materialRepository = AppDataSource.getRepository(Material);
      
      // 构建查询条件
      const queryBuilder = materialRepository.createQueryBuilder('material')
        .leftJoinAndSelect('material.creator', 'creator')
        .where('material.is_deleted = :isDeleted', { isDeleted: 0 });
      
      if (title) {
        queryBuilder.andWhere('material.title LIKE :title', { title: `%${title}%` });
      }
      
      if (fileType) {
        queryBuilder.andWhere('material.file_type = :fileType', { fileType });
      }
      
      // 获取总数
      const total = await queryBuilder.getCount();
      
      // 获取分页数据
      const materials = await queryBuilder
        .orderBy('material.created_time', 'DESC')
        .skip(skip)
        .take(take)
        .getMany();
      
      res.status(200).json({
        code: 200,
        message: '获取培训资料列表成功',
        data: {
          list: materials,
          pagination: {
            current: Number(page),
            pageSize: Number(pageSize),
            total
          }
        }
      });
    } catch (error) {
      logger.error('获取培训资料列表失败', error);
      res.status(500).json({
        code: 500,
        message: '获取培训资料列表失败',
        data: null
      });
    }
  }

  // 获取培训资料详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const materialRepository = AppDataSource.getRepository(Material);
      const material = await materialRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!material) {
        return errorResponse(res, 404, '培训资料不存在', null);
      }
      
      return successResponse(res, {
        material
      }, '获取培训资料详情成功');
    } catch (error) {
      logger.error('获取培训资料详情失败', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建培训资料
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { title, description, file_path, file_type, file_size } = req.body;
      const userId = 0 // req.user?.id;
      
      if (!title || !file_path) {
        res.status(400).json({
          code: 400,
          message: '标题和文件路径不能为空',
          data: null
        });
        return;
      }
      
      const materialRepository = AppDataSource.getRepository(Material);
      const userRepository = AppDataSource.getRepository(User);
      
      const user = await userRepository.findOne({
        where: { _id: userId }
      });
      
      if (!user) {
        res.status(404).json({
          code: 404,
          message: '用户不存在',
          data: null
        });
        return;
      }
      
      const material = new Material();
      material.title = title;
      material.description = description;
      material.file_path = file_path;
      material.file_type = file_type;
      material.file_size = file_size;
      material.creatorEntity = user;
      material.creator = user._id;
      material.updaterEntity = user;
      material.updater = user._id;
      
      const savedMaterial = await materialRepository.save(material);
      
      res.status(201).json({
        code: 201,
        message: '创建培训资料成功',
        data: savedMaterial
      });
    } catch (error) {
      logger.error('创建培训资料失败', error);
      res.status(500).json({
        code: 500,
        message: '创建培训资料失败',
        data: null
      });
    }
  }

  // 更新培训资料
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, description, file_path, file_type, file_size } = req.body;
      const userId = 0 // req.user?.id;
      
      const materialRepository = AppDataSource.getRepository(Material);
      const userRepository = AppDataSource.getRepository(User);
      
      const material = await materialRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!material) {
        res.status(404).json({
          code: 404,
          message: '培训资料不存在',
          data: null
        });
        return;
      }
      
      const user = await userRepository.findOne({
        where: { _id: userId }
      });
      
      if (!user) {
        res.status(404).json({
          code: 404,
          message: '用户不存在',
          data: null
        });
        return;
      }
      
      if (title) material.title = title;
      if (description !== undefined) material.description = description;
      if (file_path) material.file_path = file_path;
      if (file_type !== undefined) material.file_type = file_type;
      if (file_size !== undefined) material.file_size = file_size;
      material.updaterEntity = user;
      material.updater = user._id;
      
      const updatedMaterial = await materialRepository.save(material);
      
      res.status(200).json({
        code: 200,
        message: '更新培训资料成功',
        data: updatedMaterial
      });
    } catch (error) {
      logger.error('更新培训资料失败', error);
      res.status(500).json({
        code: 500,
        message: '更新培训资料失败',
        data: null
      });
    }
  }

  // 删除培训资料
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = 0 // req.user?.id;
      
      const materialRepository = AppDataSource.getRepository(Material);
      const userRepository = AppDataSource.getRepository(User);
      
      const material = await materialRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!material) {
        res.status(404).json({
          code: 404,
          message: '培训资料不存在',
          data: null
        });
        return;
      }
      
      const user = await userRepository.findOne({
        where: { _id: userId }
      });
      
      if (!user) {
        res.status(404).json({
          code: 404,
          message: '用户不存在',
          data: null
        });
        return;
      }
      
      material.is_deleted = 1;
      material.updaterEntity = user;
      material.updater = user._id;
      
      await materialRepository.save(material);
      
      res.status(200).json({
        code: 200,
        message: '删除培训资料成功',
        data: null
      });
    } catch (error) {
      logger.error('删除培训资料失败', error);
      res.status(500).json({
        code: 500,
        message: '删除培训资料失败',
        data: null
      });
    }
  }

  // 批量删除培训资料
  async batchDelete(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.body;
      const userId = 0 // req.user?.id;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          code: 400,
          message: '请选择要删除的培训资料',
          data: null
        });
        return;
      }
      
      const materialRepository = AppDataSource.getRepository(Material);
      const userRepository = AppDataSource.getRepository(User);
      
      const user = await userRepository.findOne({
        where: { _id: userId }
      });
      
      if (!user) {
        res.status(404).json({
          code: 404,
          message: '用户不存在',
          data: null
        });
        return;
      }
      
      await materialRepository.update(
        { _id: In(ids), is_deleted: 0 },
        { is_deleted: 1, updater: user._id }
      );
      
      res.status(200).json({
        code: 200,
        message: '批量删除培训资料成功',
        data: null
      });
    } catch (error) {
      logger.error('批量删除培训资料失败', error);
      res.status(500).json({
        code: 500,
        message: '批量删除培训资料失败',
        data: null
      });
    }
  }

  // 关联课件
  async associateCourseware(req: Request, res: Response): Promise<void> {
    try {
      const { materialId, coursewareIds } = req.body;
      
      if (!materialId || !coursewareIds || !Array.isArray(coursewareIds) || coursewareIds.length === 0) {
        res.status(400).json({
          code: 400,
          message: '参数错误',
          data: null
        });
        return;
      }
      
      const materialRepository = AppDataSource.getRepository(Material);
      const coursewareRepository = AppDataSource.getRepository(Courseware);
      const coursewareMaterialRepository = AppDataSource.getRepository(CoursewareMaterial);
      
      // 检查培训资料是否存在
      const material = await materialRepository.findOne({
        where: { _id: materialId, is_deleted: 0 }
      });
      
      if (!material) {
        res.status(404).json({
          code: 404,
          message: '培训资料不存在',
          data: null
        });
        return;
      }
      
      // 检查课件是否存在
      const coursewares = await coursewareRepository.find({
        where: { _id: In(coursewareIds), is_deleted: 0 }
      });
      
      if (coursewares.length !== coursewareIds.length) {
        res.status(404).json({
          code: 404,
          message: '部分课件不存在',
          data: null
        });
        return;
      }
      
      // 删除现有关联
      await coursewareMaterialRepository.delete({ material_id: materialId });
      
      // 创建新关联
      const coursewareMaterials = coursewareIds.map(coursewareId => {
        const coursewareMaterial = new CoursewareMaterial();
        coursewareMaterial.courseware_id = coursewareId;
        coursewareMaterial.material_id = materialId;
        return coursewareMaterial;
      });
      
      await coursewareMaterialRepository.save(coursewareMaterials);
      
      res.status(200).json({
        code: 200,
        message: '关联课件成功',
        data: null
      });
    } catch (error) {
      logger.error('关联课件失败', error);
      res.status(500).json({
        code: 500,
        message: '关联课件失败',
        data: null
      });
    }
  }

  // 获取培训资料关联的课件
  async getAssociatedCoursewares(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const materialRepository = AppDataSource.getRepository(Material);
      
      const material = await materialRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 },
        relations: ['coursewares']
      });
      
      if (!material) {
        res.status(404).json({
          code: 404,
          message: '培训资料不存在',
          data: null
        });
        return;
      }
      
      res.status(200).json({
        code: 200,
        message: '获取关联课件成功',
        data: null // material.coursewares
      });
    } catch (error) {
      logger.error('获取关联课件失败', error);
      res.status(500).json({
        code: 500,
        message: '获取关联课件失败',
        data: null
      });
    }
  }
}