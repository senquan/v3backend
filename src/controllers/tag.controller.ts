import { Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { Tag } from "../models/entities/Tag.entity";
import { logger } from "../utils/logger";
import { errorResponse, successResponse } from "../utils/response";
import { In } from "typeorm";

export class TagController {
  // 获取标签列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, format = "", category } = req.query;
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(Tag)
        .createQueryBuilder("tag")
        .where("tag.is_deleted = :is_deleted", { is_deleted: false });
      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere("tag.name LIKE :keyword", { keyword: `%${keyword}%` });
      }

      if (category) {
        queryBuilder.andWhere("tag.category = :category", { category: Number(category) });
      }

      if (format === "opt") {
        // 查询所有标签
        const tags = await queryBuilder.getMany();
        const options = tags.map(tag => ({
          id: tag.id,
          parentId: tag.parent_id,
          name: tag.name,
          color: tag.color,
          category: tag.category,
          sort: tag.sort,
          description: tag.description,
        }));
        return successResponse(res, {
          tags: options
        }, "获取标签列表成功");
      } else {
        queryBuilder.leftJoinAndSelect("tag.parent", "parent");
        // 计算分页
        const pageNum = Number(page);
        const pageSizeNum = Number(pageSize);
        const skip = (pageNum - 1) * pageSizeNum;
        
        // 获取总数和分页数据
        const [tags, total] = await queryBuilder
          .orderBy("tag.id", "ASC")
          .skip(skip)
          .take(pageSizeNum)
          .getManyAndCount();
        
        return successResponse(res, {
          tags,
          total,
          page: pageNum,
          pageSize: pageSizeNum
        }, "获取标签列表成功");
      }
    } catch (error) {
      logger.error("获取标签列表失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }
  
  // 获取所有标签（用于下拉选择）
  async getAllTags(req: Request, res: Response): Promise<Response> {
    try {
      const tags = await AppDataSource.getRepository(Tag)
        .createQueryBuilder("tag")
        .where("tag.is_deleted = :is_deleted", { is_deleted: false })
        .orderBy("tag.id", "ASC")
        .getMany();
      
      return successResponse(res, tags, "获取所有标签成功");
    } catch (error) {
      logger.error("获取所有标签失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }

  // 获取树状结构的标签列表
  async getTree(req: Request, res: Response): Promise<Response> {
    try {
      const tags = await AppDataSource.getRepository(Tag)
        .createQueryBuilder("tag")
        .where("tag.is_deleted = :is_deleted", { is_deleted: false })
        .getMany();

      const treeTags = tags.reduce((acc: any, tag: any) => {
        if (tag.parent_id === null) {
          acc[tag.id] = {
            ...tag,
            children: []
          };
        } else {
          if (acc[tag.parent_id]) {
            acc[tag.parent_id].children.push({
              ...tag,
              children: []
            });
          }
        }
        return acc;
      }, {});
      
      return successResponse(res, {
          tags: treeTags,
          total: Object.keys(treeTags).length
        }, "获取标签列表成功");
    } catch (error) {
      logger.error("获取标签列表失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }
  
  // 获取标签详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const tag = await AppDataSource.getRepository(Tag)
        .createQueryBuilder("tag")
        .leftJoinAndSelect("tag.parent", "parent")
        .where("tag.id = :id", { id })
        .andWhere("tag.is_deleted = :is_deleted", { is_deleted: false })
        .getOne();
      
      if (!tag) {
        return errorResponse(res, 404, "标签不存在", null);
      }
      
      return successResponse(res, tag, "获取标签详情成功");
    } catch (error) {
      logger.error("获取标签详情失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }
  
  // 创建标签
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { name, parentId, color, category = 0, sort = 0, description } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, "标签名称不能为空", null);
      }
      
      // 检查标签名称是否已存在
      const tagRepository = AppDataSource.getRepository(Tag);
      const existingTag = await tagRepository.findOne({
        where: { name, is_deleted: false }
      });
      
      if (existingTag) {
        return errorResponse(res, 400, "标签名称已存在", null);
      }

      // 创建新标签
      const tag = new Tag();
      tag.name = name;
      tag.color = color;
      tag.category = category;
      tag.sort = sort;
      tag.description = description;

      if (Number(parentId) > 0) {
        const parentTag = await tagRepository.findOne({
          where: { id: Number(parentId), is_deleted: false }
        });

        if (!parentTag) {
          return errorResponse(res, 400, "父标签不存在", null);
        }
        tag.parent = parentTag;
        tag.parent_id = parentTag.id;
      }
      
      const savedTag = await tagRepository.save(tag);
      
      return successResponse(res, savedTag, "创建标签成功");
    } catch (error) {
      logger.error("创建标签失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }
  
  // 更新标签
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name, parentId, color, category, sort, description } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, "标签名称不能为空", null);
      }
      
      const tagRepository = AppDataSource.getRepository(Tag);
      
      // 检查标签是否存在
      const tag = await tagRepository.findOne({
        where: { id: Number(id), is_deleted: false },
        relations: ["parent"]
      });
      
      if (!tag) {
        return errorResponse(res, 404, "标签不存在", null);
      }
      
      // 检查名称是否重复
      if (name !== tag.name) {
        const existingTag = await tagRepository.findOne({
          where: { name, is_deleted: false }
        });

        if (existingTag && existingTag.id !== tag.id) {
          return errorResponse(res, 400, "标签名称已存在", null);
        }
      }

      // 更新标签信息
      tag.name = name;
      tag.color = color;
      tag.category = category;
      tag.sort = sort;
      tag.description = description;
      
      if (Number(parentId) > 0 && parentId !== tag.parent_id) {
        const parentTag = await tagRepository.findOne({
          where: { id: Number(parentId), is_deleted: false }
        });

        if (!parentTag) {
          return errorResponse(res, 400, "父标签不存在", null);
        }
        
        // 检查是否会形成循环引用
        if (parentTag.id === tag.id) {
          return errorResponse(res, 400, "不能将标签设置为自己的父标签", null);
        }
        
        tag.parent = parentTag;
        tag.parent_id = parentTag.id;
      } else if (Number(parentId) === 0) {
        tag.parent_id = null;
      }
      
      const updatedTag = await tagRepository.save(tag);
      return successResponse(res, updatedTag, "更新标签成功");
    } catch (error) {
      logger.error("更新标签失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }

  // 删除标签（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const tagRepository = AppDataSource.getRepository(Tag);
      
      // 检查标签是否存在
      const tag = await tagRepository.findOne({
        where: { id: Number(id), is_deleted: false }
      });
      
      if (!tag) {
        return errorResponse(res, 404, "标签不存在", null);
      }

      // 检查是否有子标签
      const childTags = await tagRepository.find({
        where: { parent_id: tag.id, is_deleted: false }
      });

      if (childTags.length > 0) {
        return errorResponse(res, 400, "该标签下还有子标签，无法删除", null);
      }
 
      // 软删除标签
      tag.is_deleted = true;
      await tagRepository.save(tag);
      
      return successResponse(res, null, "删除标签成功");
    } catch (error) {
      logger.error("删除标签失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }

  // 批量删除标签
  async batchDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, "请选择要删除的标签", null);
      }
      
      const tagRepository = AppDataSource.getRepository(Tag);
      
      // 检查所有标签是否存在
      const tags = await tagRepository.find({
        where: { id: In(ids), is_deleted: false }
      });
      
      if (tags.length !== ids.length) {
        return errorResponse(res, 400, "部分标签不存在", null);
      }

      // 检查是否有子标签
      for (const tag of tags) {
        const childTags = await tagRepository.find({
          where: { parent_id: tag.id, is_deleted: false }
        });

        if (childTags.length > 0) {
          return errorResponse(res, 400, `标签"${tag.name}"下还有子标签，无法删除`, null);
        }
      }
      
      // 批量软删除
      await tagRepository.update(
        { id: In(ids) },
        { is_deleted: true }
      );
      
      return successResponse(res, null, "批量删除标签成功");
    } catch (error) {
      logger.error("批量删除标签失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }

  // 递归删除标签及其下级所有标签
  async deleteGroup(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const tagRepository = AppDataSource.getRepository(Tag);
      
      // 检查标签是否存在
      const tag = await tagRepository.findOne({
        where: { id: Number(id), is_deleted: false }
      });
      
      if (!tag) {
        return errorResponse(res, 404, "标签不存在", null);
      }
      
      // 递归删除下级标签
      const deleteChildTags = async (tagId: number) => {
        const childTags = await tagRepository.find({
          where: { parent_id: tagId, is_deleted: false }
        });
        
        if (childTags.length > 0) {
          for (const childTag of childTags) {
            await deleteChildTags(childTag.id);
          }
        }
        // 软删除当前标签
        await tagRepository.update(
          { id: tagId },
          { is_deleted: true }
        );
      };
      
      // 递归删除下级标签
      await deleteChildTags(Number(id));
      // 删除当前标签
      await tagRepository.delete(Number(id));
      // 软删除当前标签
      tag.is_deleted = true;
      await tagRepository.save(tag);

      return successResponse(res, null, "删除标签组成功");
    } catch (error) {
      logger.error("删除标签组失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }

}