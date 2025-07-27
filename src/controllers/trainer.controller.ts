import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Trainer } from '../models/entities/Trainer.entity';
import { User } from '../models/entities/User.entity';
import { Tag } from '../models/entities/Tag.entity';
import { TrainerTag } from '../models/entities/TrainerTag.entity';
import { successResponse, errorResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { Like, In } from 'typeorm';

export class TrainerController {
  // 获取讲师列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const {
        page = 1,
        pageSize = 10,
        keyword = '',
        type = '',
        grade = '',
        status = '',
        tags = []
      } = req.query;

      const trainerRepository = AppDataSource.getRepository(Trainer);
      const queryBuilder = trainerRepository.createQueryBuilder('trainer')
        .leftJoinAndSelect('trainer.user', 'user')
        .leftJoinAndSelect('trainer.trainerTags', 'trainerTags')
        .leftJoinAndSelect('trainerTags.tag', 'tag')
        .where('trainer.is_deleted = :isDeleted', { isDeleted: 0 });

      // 关键词搜索
      if (keyword) {
        queryBuilder.andWhere(
          '(trainer.name LIKE :keyword OR trainer.email LIKE :keyword OR trainer.phone LIKE :keyword)',
          { keyword: `%${keyword}%` }
        );
      }

      // 讲师类型筛选
      if (type) {
        queryBuilder.andWhere('trainer.type = :type', { type: Number(type) });
      }

      // 讲师等级筛选
      if (grade) {
        queryBuilder.andWhere('trainer.grade = :grade', { grade: Number(grade) });
      }

      // 状态筛选（如果有状态字段）
      if (status) {
        queryBuilder.andWhere('trainer.status = :status', { status: Number(status) });
      }

      // 标签搜索
      if (Array.isArray(tags) && tags.length > 0) {
        queryBuilder.andWhere('trainerTags.tag_id IN (:...tags)', { tags: tags.map(Number) });
      }

      // 排序
      queryBuilder.orderBy('trainer.created_at', 'DESC');

      // 分页
      const skip = (Number(page) - 1) * Number(pageSize);
      queryBuilder.skip(skip).take(Number(pageSize));

      const [trainers, total] = await queryBuilder.getManyAndCount();

      // 格式化返回数据
      const formattedTrainers = trainers.map(trainer => ({
        id: trainer.id,
        type: trainer.type,
        name: trainer.name,
        user_id: trainer.user_id,
        avatar: trainer.avatar,
        grade: trainer.grade,
        email: trainer.email,
        phone: trainer.phone,
        position: trainer.position,
        title: trainer.title,
        idcard: trainer.idcard,
        bank: trainer.bank,
        bankcard: trainer.bankcard,
        fee: trainer.fee,
        introduction: trainer.introduction,
        created_at: trainer.created_at,
        updated_at: trainer.updated_at,
        score: trainer.score,
        courseCount: 0,
        showInHome: trainer.show_in_home,
        user: trainer.user ? {
          id: trainer.user._id,
          username: trainer.user.name,
          realname: trainer.user.realname,
          email: trainer.user.email
        } : null,
        tags: trainer.trainerTags?.map(tt => ({
          id: tt.tag.id,
          name: tt.tag.name,
          color: tt.tag.color
        })) || []
      }));

      return successResponse(res, {
        trainers: formattedTrainers,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取讲师列表成功');
    } catch (error) {
      logger.error('获取讲师列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取讲师详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const trainerRepository = AppDataSource.getRepository(Trainer);
      
      const trainer = await trainerRepository.findOne({
        where: { id: Number(id), is_deleted: false },
        relations: ['user', 'trainerTags', 'trainerTags.tag']
      });
      
      if (!trainer) {
        return errorResponse(res, 404, '讲师不存在', null);
      }
      
      // 格式化返回数据
      const formattedTrainer = {
        id: trainer.id,
        type: trainer.type,
        name: trainer.name,
        user_id: trainer.user_id,
        avatar: trainer.avatar,
        grade: trainer.grade,
        email: trainer.email,
        phone: trainer.phone,
        position: trainer.position,
        title: trainer.title,
        idcard: trainer.idcard,
        bank: trainer.bank,
        bankcard: trainer.bankcard,
        fee: trainer.fee,
        introduction: trainer.introduction,
        created_at: trainer.created_at,
        updated_at: trainer.updated_at,
        user: trainer.user ? {
          id: trainer.user._id,
          username: trainer.user.name,
          realname: trainer.user.realname,
          email: trainer.user.email
        } : null,
        tags: trainer.trainerTags?.map(tt => ({
          id: tt.tag.id,
          name: tt.tag.name,
          color: tt.tag.color
        })) || []
      };
      
      return successResponse(res, formattedTrainer, '获取讲师详情成功');
    } catch (error) {
      logger.error('获取讲师详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建讲师
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const {
        type,
        user_id,
        avatar,
        grade,
        email,
        position,
        title,
        idcard,
        bank,
        bankcard,
        fee,
        introduction,
        tag_ids = []
      } = req.body;

      let {
        name,
        phone
      } = req.body;
      
      if (!type) {
        return errorResponse(res, 400, '讲师类型不能为空', null);
      }
      
      const trainerRepository = AppDataSource.getRepository(Trainer);
      const userRepository = AppDataSource.getRepository(User);
      const tagRepository = AppDataSource.getRepository(Tag);
      const trainerTagRepository = AppDataSource.getRepository(TrainerTag);
      
      // 检查用户是否存在
      if (type === 1) {
        if (user_id) {
          const user = await userRepository.findOne({
            where: { _id: Number(user_id) }
          });
          
          if (!user) {
            return errorResponse(res, 404, '关联用户不存在', null);
          }
          name = user.realname || user.name;
          phone = user.phone;
        } else {
          return errorResponse(res, 400, '关联用户不能为空', null);
        }
      } else if (type === 2) {
        if (!name) {
          return errorResponse(res, 400, '讲师姓名不能为空', null);
        }
        // 检查邮箱是否重复
        if (email) {
          const existingTrainer = await trainerRepository.findOne({
            where: { email, is_deleted: false }
          });
          
          if (existingTrainer) {
            return errorResponse(res, 400, '邮箱已存在', null);
          }
        }
        // 检查手机号是否重复
        if (phone) {
          const existingTrainer = await trainerRepository.findOne({
            where: { phone, is_deleted: false }
          });
          
          if (existingTrainer) {
            return errorResponse(res, 400, '手机号已存在', null);
          }
        }
      } else {
        return errorResponse(res, 400, '讲师类型错误', null);
      }
      
      // 创建讲师
      const trainer = new Trainer();
      trainer.type = Number(type);
      trainer.name = name;
      trainer.user_id = user_id ? Number(user_id) : null;
      trainer.avatar = avatar || null;
      trainer.grade = grade ? Number(grade) : 1;
      trainer.email = email || null;
      trainer.phone = phone || null;
      trainer.position = position || null;
      trainer.title = title || null;
      trainer.idcard = idcard || null;
      trainer.bank = bank || null;
      trainer.bankcard = bankcard || null;
      trainer.fee = fee ? Number(fee) : null;
      trainer.introduction = introduction || null;
      trainer.is_deleted = false;
      
      const savedTrainer = await trainerRepository.save(trainer);
      
      // 处理标签关联
      if (tag_ids && tag_ids.length > 0) {
        const validTags = await tagRepository.find({
          where: { id: In(tag_ids), is_deleted: false }
        });
        
        const trainerTags = validTags.map(tag => {
          const trainerTag = new TrainerTag();
          trainerTag.trainer_id = savedTrainer.id;
          trainerTag.tag_id = tag.id;
          return trainerTag;
        });
        console.log("trainerTags", trainerTags)
        await trainerTagRepository.save(trainerTags);
      }
      
      return successResponse(res, { id: savedTrainer.id }, '创建讲师成功');
    } catch (error) {
      logger.error('创建讲师失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新讲师
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const {
        type,
        name,
        user_id,
        avatar,
        grade,
        email,
        phone,
        position,
        title,
        idcard,
        bank,
        bankcard,
        fee,
        introduction,
        tag_ids = []
      } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '讲师姓名不能为空', null);
      }
      
      const trainerRepository = AppDataSource.getRepository(Trainer);
      const userRepository = AppDataSource.getRepository(User);
      const tagRepository = AppDataSource.getRepository(Tag);
      const trainerTagRepository = AppDataSource.getRepository(TrainerTag);
      
      // 检查讲师是否存在
      const trainer = await trainerRepository.findOne({
        where: { id: Number(id), is_deleted: false }
      });
      
      if (!trainer) {
        return errorResponse(res, 404, '讲师不存在', null);
      }
      
      // 检查用户是否存在
      if (user_id) {
        const user = await userRepository.findOne({
          where: { _id: Number(user_id) }
        });
        
        if (!user) {
          return errorResponse(res, 404, '关联用户不存在', null);
        }
      }
      
      // 检查邮箱是否重复（排除自身）
      if (email) {
        const existingTrainer = await trainerRepository.findOne({
          where: { email, is_deleted: false }
        });
        
        if (existingTrainer && existingTrainer.id !== Number(id)) {
          return errorResponse(res, 400, '邮箱已存在', null);
        }
      }
      
      // 检查手机号是否重复（排除自身）
      if (phone) {
        const existingTrainer = await trainerRepository.findOne({
          where: { phone, is_deleted: false }
        });
        
        if (existingTrainer && existingTrainer.id !== Number(id)) {
          return errorResponse(res, 400, '手机号已存在', null);
        }
      }
      
      // 更新讲师信息
      trainer.type = Number(type);
      trainer.name = name;
      trainer.user_id = user_id ? Number(user_id) : null;
      trainer.avatar = avatar || null;
      trainer.grade = grade ? Number(grade) : 1;
      trainer.email = email || null;
      trainer.phone = phone || null;
      trainer.position = position || null;
      trainer.title = title || null;
      trainer.idcard = idcard || null;
      trainer.bank = bank || null;
      trainer.bankcard = bankcard || null;
      trainer.fee = fee ? Number(fee) : null;
      trainer.introduction = introduction || null;
      
      await trainerRepository.save(trainer);
      
      // 处理标签关联
      // 先删除现有关联
      await trainerTagRepository.delete({ trainer_id: trainer.id });
      
      // 创建新关联
      if (tag_ids && tag_ids.length > 0) {
        const validTags = await tagRepository.find({
          where: { id: In(tag_ids), is_deleted: false }
        });
        
        const trainerTags = validTags.map(tag => {
          const trainerTag = new TrainerTag();
          trainerTag.trainer_id = trainer.id;
          trainerTag.tag_id = tag.id;
          return trainerTag;
        });
        
        await trainerTagRepository.save(trainerTags);
      }
      
      return successResponse(res, { id: trainer.id }, '更新讲师成功');
    } catch (error) {
      logger.error('更新讲师失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除讲师
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const trainerRepository = AppDataSource.getRepository(Trainer);
      
      // 检查讲师是否存在
      const trainer = await trainerRepository.findOne({
        where: { id: Number(id), is_deleted: false }
      });
      
      if (!trainer) {
        return errorResponse(res, 404, '讲师不存在', null);
      }
      
      // 软删除讲师
      trainer.is_deleted = true;
      // trainer.updater_id = req.user?.id || null;
      await trainerRepository.save(trainer);
      
      return successResponse(res, null, '删除讲师成功');
    } catch (error) {
      logger.error('删除讲师失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 批量删除讲师
  async batchDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要删除的讲师', null);
      }
      
      const trainerRepository = AppDataSource.getRepository(Trainer);
      
      // 查找所有要删除的讲师
      const trainers = await trainerRepository.find({
        where: ids.map(id => ({ id: id, is_deleted: false }))
      });
      
      if (trainers.length === 0) {
        return errorResponse(res, 404, '未找到要删除的讲师', null);
      }
      
      // 软删除所有讲师
      for (const trainer of trainers) {
        trainer.is_deleted = true;
        // trainer.updater_id = req.user?.id || null;
      }
      
      await trainerRepository.save(trainers);
      
      return successResponse(res, null, `成功删除${trainers.length}个讲师`);
    } catch (error) {
      logger.error('批量删除讲师失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取用户列表（用于关联用户）
  async getUsers(req: Request, res: Response): Promise<Response> {
    try {
      const { keyword = '' } = req.query;
      
      const userRepository = AppDataSource.getRepository(User);
      const queryBuilder = userRepository.createQueryBuilder('user')
        .select(['user.id', 'user.username', 'user.email'])
        .where('user.is_deleted = :isDeleted', { isDeleted: 0 });
      
      if (keyword) {
        queryBuilder.andWhere(
          '(user.username LIKE :keyword OR user.email LIKE :keyword)',
          { keyword: `%${keyword}%` }
        );
      }
      
      queryBuilder.orderBy('user.created_at', 'DESC').limit(50);
      
      const users = await queryBuilder.getMany();
      
      return successResponse(res, users, '获取用户列表成功');
    } catch (error) {
      logger.error('获取用户列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取标签列表（用于关联标签）
  async getTags(req: Request, res: Response): Promise<Response> {
    try {
      const { keyword = '' } = req.query;
      
      const tagRepository = AppDataSource.getRepository(Tag);
      const queryBuilder = tagRepository.createQueryBuilder('tag')
        .where('tag.is_deleted = :isDeleted', { isDeleted: 0 });
      
      if (keyword) {
        queryBuilder.andWhere('tag.name LIKE :keyword', { keyword: `%${keyword}%` });
      }
      
      queryBuilder.orderBy('tag.created_at', 'DESC');
      
      const tags = await queryBuilder.getMany();
      
      return successResponse(res, tags, '获取标签列表成功');
    } catch (error) {
      logger.error('获取标签列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}