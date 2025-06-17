import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../models/entities/User.entity';
import { Courseware } from '../models/entities/Courseware.entity';
import { Material } from '../models/entities/Material.entity';
import { CoursewareMaterial } from '../models/entities/CoursewareMaterial.entity';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class CoursewareController {
  // 获取课件列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, category, status, sort } = req.query;
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(Courseware)
        .createQueryBuilder('courseware')
        .where('courseware.is_deleted = :is_deleted', { is_deleted: 0 });
      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere('(courseware.title LIKE :keyword OR courseware.description LIKE :keyword)', { keyword: `%${keyword}%` });
      }

      if (category) {
        queryBuilder.andWhere('courseware.category = :category', { category: Number(category) });
      }

      if (status) {
        queryBuilder.andWhere('courseware.status = :status', { status: Number(status) });
      }

      // 添加排序
      if (sort) {
        const order = String(sort).substring(0, 1);
        const field = String(sort).substring(1);
        if (field && order) {
          queryBuilder.orderBy(`courseware.${field}`, order === "+" ? "ASC" : "DESC");
        }
      } else {
        queryBuilder.orderBy('courseware.created_time', 'DESC');
      }

      // 分页
      const total = await queryBuilder.getCount();
      const coursewares = await queryBuilder
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getMany();

      // 格式化返回数据
      const formattedCoursewares = coursewares.map(courseware => ({
        id: courseware._id,
        title: courseware.title,
        description: courseware.description,
        category: courseware.category,
        tags: courseware.tags,
        status: courseware.status,
        view_count: courseware.view_count,
        download_count: courseware.download_count,
        created_time: courseware.created_time,
        updated_time: courseware.updated_time
      }));

      return successResponse(res, {
        coursewares: formattedCoursewares,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取课件列表成功');
    } catch (error) {
      logger.error('获取课件列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取课件详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const courseware = await AppDataSource.getRepository(Courseware)
        .createQueryBuilder('courseware')
        .leftJoinAndSelect('courseware.coursewareMaterials', 'materials')
        .leftJoinAndSelect('materials.material', 'material')
        .where('courseware._id = :id', { id: Number(id) })
        .andWhere('courseware.is_deleted = :is_deleted', { is_deleted: 0 })
        .getOne();
      
      if (!courseware) {
        return errorResponse(res, 404, '课件不存在', null);
      }

      // 更新查看次数
      courseware.view_count += 1;
      await AppDataSource.getRepository(Courseware).save(courseware);
      
      // 格式化返回数据
      const formattedCourseware = {
        id: courseware._id,
        title: courseware.title,
        description: courseware.description,
        category: courseware.category,
        tags: courseware.tags,
        materials: courseware.coursewareMaterials.map(m => ({
          id: m.material._id,
          title: m.material.title,
          file_path: m.material.file_path
        })),
        status: courseware.status,
        view_count: courseware.view_count,
        download_count: courseware.download_count,
        created_time: courseware.created_time,
        updated_time: courseware.updated_time
      };

      return successResponse(res, formattedCourseware, '获取课件详情成功');
    } catch (error) {
      logger.error('获取课件详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建课件
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        title, 
        description, 
        files,
        category, 
        tags, 
        status 
      } = req.body;
      
      if (!title) {
        return errorResponse(res, 400, '课件标题不能为空', null);
      }
      
      // 检查课件标题是否已存在
      const coursewareRepository = AppDataSource.getRepository(Courseware);
      const existingCourseware = await coursewareRepository.findOne({
        where: { title, is_deleted: 0 }
      });
      
      if (existingCourseware) {
        return errorResponse(res, 400, '课件标题已存在', null);
      }

      // 创建新课件
      const newCourseware = coursewareRepository.create({
        title,
        description,
        category: category ? Number(category) : 0,
        tags,
        status: status ? Number(status) : 0,
        view_count: 0,
        download_count: 0,
        is_deleted: 0,
        // creator_id: req.user?.id || null,
        // updater_id: req.user?.id || null
      });

      const savedCourseware = await coursewareRepository.save(newCourseware);

      const materialRepository = AppDataSource.getRepository(Material);
      const coursewareMaterialRepository = AppDataSource.getRepository(CoursewareMaterial);
      if (files && files.length > 0) {
        const contentPromises = files.map(async (content: { name: string, url: string }) => {
            const material = new Material();
            material.title = content.name;
            material.file_path = content.url;
            const savedMaterial = await materialRepository.save(material);
            const coursewareMaterial = new CoursewareMaterial();
            coursewareMaterial.courseware_id = savedCourseware._id;
            coursewareMaterial.material_id = savedMaterial._id;
            return coursewareMaterialRepository.save(coursewareMaterial);
        });
        await Promise.all(contentPromises);
      }

      return successResponse(res, { id: newCourseware._id }, '创建课件成功');
    } catch (error) {
      logger.error('创建课件失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新课件
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { 
        title, 
        description, 
        files, 
        category, 
        tags, 
        status 
      } = req.body;
      
      if (!title) {
        return errorResponse(res, 400, '课件标题不能为空', null);
      }
      
      const coursewareRepository = AppDataSource.getRepository(Courseware);
      
      // 检查课件是否存在
      const courseware = await coursewareRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 },
        relations: ['coursewareMaterials', 'coursewareMaterials.material']
      });
      
      if (!courseware) {
        return errorResponse(res, 404, '课件不存在', null);
      }

      // 检查标题是否重复（排除自身）
      const existingCourseware = await coursewareRepository.findOne({
        where: { title, is_deleted: 0 }
      });

      if (existingCourseware && existingCourseware._id !== Number(id)) {
        return errorResponse(res, 400, '课件标题已存在', null);
      }

      // 更新课件信息
      courseware.title = title;
      courseware.description = description;
      if (category) courseware.category = Number(category);
      if (tags) courseware.tags = tags;
      if (status !== undefined) courseware.status = Number(status);
      // courseware.updater_id = req.user?.id || null;

      await coursewareRepository.save(courseware);

      const oldFiles = courseware.coursewareMaterials.map(m => ({
        id: m.material._id,
        name: m.material.title,
        file_path: m.material.file_path
      }));
      const newFiles = files || [];
      const deletedFiles = oldFiles.filter((f: any) => !newFiles.some((n: any) => n.url === f.file_path));
      const addedFiles = newFiles.filter((f: any) => !oldFiles.some((o: any) => o.file_path === f.url));
      if (deletedFiles.length > 0 || addedFiles.length > 0) {
        const coursewareMaterialRepository = AppDataSource.getRepository(CoursewareMaterial);
        const materialRepository = AppDataSource.getRepository(Material);
        deletedFiles.map(async (f: any) => {
          if (f.id) {
            await coursewareMaterialRepository.delete({ material_id: f.id });
            await materialRepository.delete({ _id: f.id });
          }
        });
        addedFiles.map(async (f: any) => {
          const material = new Material();
          material.title = f.name;
          material.file_path = f.url;
          const savedMaterial = await materialRepository.save(material);
          const coursewareMaterial = new CoursewareMaterial();
          coursewareMaterial.courseware_id = courseware._id;
          coursewareMaterial.material_id = savedMaterial._id;
          return coursewareMaterialRepository.save(coursewareMaterial);
        });
      }

      return successResponse(res, { id: courseware._id }, '更新课件成功');
    } catch (error) {
      logger.error('更新课件失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除课件
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const coursewareRepository = AppDataSource.getRepository(Courseware);
      
      // 检查课件是否存在
      const courseware = await coursewareRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!courseware) {
        return errorResponse(res, 404, '课件不存在', null);
      }
      
      // 软删除课件
      courseware.is_deleted = 1;
      // courseware.updater_id = req.user?.id || null;
      await coursewareRepository.save(courseware);
      
      return successResponse(res, null, '删除课件成功');
    } catch (error) {
      logger.error('删除课件失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 批量删除课件
  async batchDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要删除的课件', null);
      }
      
      const coursewareRepository = AppDataSource.getRepository(Courseware);
      
      // 查找所有要删除的课件
      const coursewares = await coursewareRepository.find({
        where: ids.map(id => ({ _id: id, is_deleted: 0 }))
      });
      
      if (coursewares.length === 0) {
        return errorResponse(res, 404, '未找到要删除的课件', null);
      }
      
      // 软删除所有课件
      for (const courseware of coursewares) {
        courseware.is_deleted = 1;
        // courseware.updater_id = req.user?.id || null;
      }
      
      await coursewareRepository.save(coursewares);
      
      return successResponse(res, null, `成功删除${coursewares.length}个课件`);
    } catch (error) {
      logger.error('批量删除课件失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新课件下载次数
  async updateDownloadCount(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const coursewareRepository = AppDataSource.getRepository(Courseware);
      
      // 检查课件是否存在
      const courseware = await coursewareRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!courseware) {
        return errorResponse(res, 404, '课件不存在', null);
      }
      
      // 更新下载次数
      courseware.download_count += 1;
      await coursewareRepository.save(courseware);
      
      return successResponse(res, { download_count: courseware.download_count }, '更新下载次数成功');
    } catch (error) {
      logger.error('更新下载次数失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 关联培训资料
  async associateMaterials(req: Request, res: Response): Promise<Response> {
    try {
      const { coursewareId, materialIds } = req.body;
      
      if (!coursewareId || !materialIds || !Array.isArray(materialIds) || materialIds.length === 0) {
        return errorResponse(res, 400, '参数错误', null);
      }
      
      const coursewareRepository = AppDataSource.getRepository(Courseware);
      const materialRepository = AppDataSource.getRepository(Material);
      const coursewareMaterialRepository = AppDataSource.getRepository(CoursewareMaterial);
      
      // 检查课件是否存在
      const courseware = await coursewareRepository.findOne({
        where: { _id: Number(coursewareId), is_deleted: 0 }
      });
      
      if (!courseware) {
        return errorResponse(res, 404, '课件不存在', null);
      }
      
      // 检查培训资料是否存在
      const materials = await materialRepository.find({
        where: materialIds.map(id => ({ _id: id, is_deleted: 0 }))
      });
      
      if (materials.length !== materialIds.length) {
        return errorResponse(res, 404, '部分培训资料不存在', null);
      }
      
      // 删除现有关联
      await coursewareMaterialRepository.delete({ courseware_id: coursewareId });
      
      // 创建新关联
      const coursewareMaterials = materialIds.map(materialId => {
        const coursewareMaterial = new CoursewareMaterial();
        coursewareMaterial.courseware_id = coursewareId;
        coursewareMaterial.material_id = materialId;
        return coursewareMaterial;
      });
      
      await coursewareMaterialRepository.save(coursewareMaterials);
      
      return successResponse(res, null, '关联培训资料成功');
    } catch (error) {
      logger.error('关联培训资料失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取课件关联的培训资料
  async getAssociatedMaterials(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const coursewareRepository = AppDataSource.getRepository(Courseware);
      
      // 检查课件是否存在
      const courseware = await coursewareRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 },
        relations: ['materials']
      });
      
      if (!courseware) {
        return errorResponse(res, 404, '课件不存在', null);
      }
      
      const formattedMaterials = null
      // 格式化返回数据
      // const formattedMaterials = courseware.materials.map(material => ({
      //   id: material._id,
      //   title: material.title,
      //   description: material.description,
      //   file_path: material.file_path,
      //   file_type: material.file_type,
      //   file_size: material.file_size,
      //   created_time: material.created_time,
      //   updated_time: material.updated_time
      // }));
      
      return successResponse(res, formattedMaterials, '获取关联培训资料成功');
    } catch (error) {
      logger.error('获取关联培训资料失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}