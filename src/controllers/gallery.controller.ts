import { Request, Response } from "express";
import { In, Like } from "typeorm";
import { AppDataSource } from "../config/database";
import { Gallery } from "../models/gallery.model";
import { Tag } from "../models/tag.model";
import { logger } from "../utils/logger";
import { errorResponse, successResponse } from "../utils/response";
import * as fs from "fs";
import * as path from "path";

export class GalleryController {
  // 获取图片列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const {
        page = 1,
        pageSize = 20,
        keyword,
        categoryId,
        tagIds,
        fileType,
        status,
        sort = "-createAt"
      } = req.query;

      const queryBuilder = AppDataSource.getRepository(Gallery)
        .createQueryBuilder("gallery")
        .leftJoinAndSelect("gallery.tags", "tags")
        .where("gallery.isDeleted = :isDeleted", { isDeleted: 0 });

      // 关键词搜索
      if (keyword) {
        queryBuilder.andWhere(
          "(gallery.title LIKE :keyword OR gallery.description LIKE :keyword OR gallery.fileName LIKE :keyword)",
          { keyword: `%${keyword}%` }
        );
      }

      // 分类筛选
      if (categoryId) {
        queryBuilder.andWhere("gallery.categoryId = :categoryId", { categoryId });
      }

      // 标签筛选
      if (tagIds) {
        const tagIdArray = Array.isArray(tagIds) ? tagIds : [tagIds];
        queryBuilder.andWhere("tags.id IN (:...tagIds)", { tagIds: tagIdArray });
      }

      // 文件类型筛选
      if (fileType) {
        queryBuilder.andWhere("gallery.fileType = :fileType", { fileType });
      }

      // 状态筛选
      if (status !== undefined) {
        queryBuilder.andWhere("gallery.status = :status", { status });
      }

      // 排序
      if (sort) {
        const order = String(sort).substring(0, 1);
        const field = String(sort).substring(1);
        const validSortFields = ["createAt", "updateAt", "title", "fileSize", "viewCount", "downloadCount", "sortOrder"];
        const sortField = validSortFields.includes(field) ? field : "createAt";
        if (field && order) {
          queryBuilder.orderBy(`gallery.${sortField}`, order === "+" ? "ASC" : "DESC");
        }
      }

      // 分页
      const skip = (Number(page) - 1) * Number(pageSize);
      queryBuilder.skip(skip).take(Number(pageSize));

      const [items, total] = await queryBuilder.getManyAndCount();

      return successResponse(res, {
        items,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize))
      });
    } catch (error) {
      logger.error("获取图片列表失败:", error);
      return errorResponse(res, 500, "获取图片列表失败", null);
    }
  }

  // 获取图片详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const gallery = await AppDataSource.getRepository(Gallery)
        .createQueryBuilder("gallery")
        .leftJoinAndSelect("gallery.tags", "tags")
        .where("gallery.id = :id AND gallery.isDeleted = :isDeleted", {
          id,
          isDeleted: 0
        })
        .getOne();

      if (!gallery) {
        return errorResponse(res, 404, "图片不存在", null);
      }

      // 增加查看次数
      await AppDataSource.getRepository(Gallery)
        .update(id, { viewCount: gallery.viewCount + 1 });

      return successResponse(res, gallery);
    } catch (error) {
      logger.error("获取图片详情失败:", error);
      return errorResponse(res, 500, "获取图片详情失败", null);
    }
  }

  // 创建图片记录
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const {
        title,
        description,
        fileName,
        filePath,
        fileUrl,
        fileSize,
        fileType,
        mimeType,
        width,
        height,
        thumbnailUrl,
        categoryId,
        altText,
        sortOrder,
        tagIds
      } = req.body;

      const userId = (req as any).user?.id;

      const gallery = new Gallery();
      gallery.title = title;
      gallery.description = description;
      gallery.fileName = fileName;
      gallery.filePath = filePath;
      gallery.fileUrl = fileUrl;
      gallery.fileSize = fileSize;
      gallery.fileType = fileType;
      gallery.mimeType = mimeType;
      gallery.width = width || 0;
      gallery.height = height || 0;
      gallery.thumbnailUrl = thumbnailUrl;
      gallery.categoryId = categoryId;
      gallery.altText = altText;
      gallery.sortOrder = sortOrder || 0;
      gallery.uploadBy = userId;

      const savedGallery = await AppDataSource.getRepository(Gallery).save(gallery);

      // 关联标签
      if (tagIds && tagIds.length > 0) {
        const tags = await AppDataSource.getRepository(Tag).findBy({
          id: In(tagIds)
        });
        savedGallery.tags = tags;
        await AppDataSource.getRepository(Gallery).save(savedGallery);
      }

      return successResponse(res, savedGallery, "图片创建成功");
    } catch (error) {
      logger.error("创建图片失败:", error);
      return errorResponse(res, 500, "创建图片失败", null);
    }
  }

  // 批量创建图片
  async batchCreate(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    try {
      const {
        category,
        title,
        tags,
        files
      } = req.body;

      await queryRunner.connect();
      await queryRunner.startTransaction();

      const userId = (req as any).user?.id;
      let successCount = 0;
      const galleryRepository = queryRunner.manager.getRepository(Gallery);

      // 处理标签
      const tagObjs: Tag[] = [];
      if (tags.length > 0) {
        const tagRepository = queryRunner.manager.getRepository(Tag);
        for (const tag of tags) {
          if (tag !== null && tag !== '') {
            const tagObj = await this.getTag(tagRepository, tag);
            if (tagObj !== null) tagObjs.push(tagObj);
          }
        }
      }

      files.forEach(async (file: any) => {
        const info = this.getFileInfo(file.url);
        const gallery = new Gallery();
        gallery.title = title || info.fileName || "unnamed";
        gallery.fileName = info.fileName || "unnamed";
        gallery.filePath = file.url;
        gallery.fileUrl = file.url;
        gallery.fileType = info.fileType;
        gallery.mimeType = file.type || "application/octet-stream";
        gallery.thumbnailUrl = file.url.replace('uploads/', 'uploads/thumb/');
        gallery.fileSize = file.size;
        gallery.width = file.width || 0;
        gallery.height = file.height || 0;
        gallery.categoryId = category;
        gallery.altText = file.url;
        gallery.uploadBy = userId;

        if (tagObjs.length > 0) {
          gallery.tags = tagObjs;
        }
        
        await galleryRepository.save(gallery);
        successCount++;
      });
      await Promise.all(files);
      await queryRunner.commitTransaction();
      return successResponse(res, files?.length, "图片批量创建成功");
    } catch (error) {
      logger.error("批量创建图片失败:", error);
      await this.exitTransaction(queryRunner);
      return errorResponse(res, 500, "批量创建图片失败", null);
    }
  }

  async getTag(tagRepository: any, tag: string | number) {
    let obj;
    if (typeof tag === 'string') {
      obj = await tagRepository.findOne({
        where: { name: tag }
      });
      if (!obj) {
        const o = tagRepository.create({
          name: tag
        });
        obj = await tagRepository.save(o);
      }
    } else if (typeof tag === 'number'){
      obj = await tagRepository.findOne({
        where: { id: tag }
      });
    } else return null;
    if (!obj) {
      return null;
    }
    return obj;
  }

  getFileInfo(fileUrl: string) {
    const fileType = fileUrl.split(".")[1];
    return {
      fileName: fileUrl.split("/").pop(),
      fileType
    }
  }

  // 更新图片信息
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        categoryId,
        alt,
        sortOrder,
        status,
        tags
      } = req.body;

      const gallery = await AppDataSource.getRepository(Gallery).findOne({
        where: { id: Number(id), isDeleted: 0 },
        relations: ["tags"]
      });

      if (!gallery) {
        return errorResponse(res, 404, "图片不存在", null);
      }

      // 更新基本信息
      if (title !== undefined) gallery.title = title;
      if (description !== undefined) gallery.description = description;
      if (categoryId !== undefined) gallery.categoryId = categoryId;
      if (alt !== undefined) gallery.altText = alt;
      if (sortOrder !== undefined) gallery.sortOrder = sortOrder;
      if (status !== undefined) gallery.status = status;

      // 更新标签关联
      if (tags !== undefined) {
        if (tags.length > 0) {
          const tagObjs = await AppDataSource.getRepository(Tag).findBy({
            id: In(tags)
          });
          gallery.tags = tagObjs;
        } else {
          gallery.tags = [];
        }
      }

      const updatedGallery = await AppDataSource.getRepository(Gallery).save(gallery);

      return successResponse(res, updatedGallery, "图片更新成功");
    } catch (error) {
      logger.error("更新图片失败:", error);
      return errorResponse(res, 500, "更新图片失败", null);
    }
  }

  // 删除图片
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { deleteFile = false } = req.body;

      const gallery = await AppDataSource.getRepository(Gallery).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!gallery) {
        return errorResponse(res, 404, "图片不存在", null);
      }

      // 软删除
      await AppDataSource.getRepository(Gallery).update(id, { isDeleted: 1 });

      // 如果需要删除物理文件
      if (deleteFile) {
        try {
          if (fs.existsSync(gallery.filePath)) {
            fs.unlinkSync(gallery.filePath);
          }
          if (gallery.thumbnailUrl) {
            const thumbnailPath = path.join(process.cwd(), gallery.thumbnailUrl.replace(/^https?:\/\/[^\/]+/, ""));
            if (fs.existsSync(thumbnailPath)) {
              fs.unlinkSync(thumbnailPath);
            }
          }
        } catch (fileError) {
          logger.warn("删除物理文件失败:", fileError);
        }
      }

      return successResponse(res, null, "图片删除成功");
    } catch (error) {
      logger.error("删除图片失败:", error);
      return errorResponse(res, 500, "删除图片失败", null);
    }
  }

  // 批量删除图片
  async batchDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids, deleteFile = false } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, "请提供要删除的图片ID列表", null);
      }

      const galleries = await AppDataSource.getRepository(Gallery).findBy({
        id: In(ids),
        isDeleted: 0
      });

      if (galleries.length === 0) {
        return errorResponse(res, 404, "没有找到要删除的图片", null);
      }

      // 批量软删除
      await AppDataSource.getRepository(Gallery).update(
        { id: In(ids) },
        { isDeleted: 1 }
      );

      // 如果需要删除物理文件
      if (deleteFile) {
        for (const gallery of galleries) {
          try {
            if (fs.existsSync(gallery.filePath)) {
              fs.unlinkSync(gallery.filePath);
            }
            if (gallery.thumbnailUrl) {
              const thumbnailPath = path.join(process.cwd(), gallery.thumbnailUrl.replace(/^https?:\/\/[^\/]+/, ""));
              if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
              }
            }
          } catch (fileError) {
            logger.warn(`删除图片 ${gallery.id} 的物理文件失败:`, fileError);
          }
        }
      }

      return successResponse(res, { deletedCount: galleries.length }, "批量删除成功");
    } catch (error) {
      logger.error("批量删除图片失败:", error);
      return errorResponse(res, 500, "批量删除图片失败", null);
    }
  }

  // 获取图片分类统计
  async getCategoryStats(req: Request, res: Response): Promise<Response> {
    try {
      const stats = await AppDataSource.getRepository(Gallery)
        .createQueryBuilder("gallery")
        .select("gallery.categoryId", "categoryId")
        .addSelect("COUNT(*)", "count")
        .where("gallery.isDeleted = :isDeleted", { isDeleted: 0 })
        .groupBy("gallery.categoryId")
        .getRawMany();

      return successResponse(res, stats);
    } catch (error) {
      logger.error("获取分类统计失败:", error);
      return errorResponse(res, 500, "获取分类统计失败", null);
    }
  }

  // 获取标签统计
  async getTagStats(req: Request, res: Response): Promise<Response> {
    try {
      const stats = await AppDataSource.getRepository(Tag)
        .createQueryBuilder("tag")
        .leftJoin("tag.galleries", "gallery")
        .select("tag.id", "tagId")
        .addSelect("tag.name", "tagName")
        .addSelect("tag.color", "tagColor")
        .addSelect("COUNT(gallery.id)", "count")
        .where("gallery.isDeleted = :isDeleted OR gallery.id IS NULL", { isDeleted: 0 })
        .groupBy("tag.id")
        .getRawMany();

      return successResponse(res, stats);
    } catch (error) {
      logger.error("获取标签统计失败:", error);
      return errorResponse(res, 500, "获取标签统计失败", null);
    }
  }

  // 增加下载次数
  async incrementDownload(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const gallery = await AppDataSource.getRepository(Gallery).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!gallery) {
        return errorResponse(res, 404, "图片不存在", null);
      }

      await AppDataSource.getRepository(Gallery)
        .update(id, { downloadCount: gallery.downloadCount + 1 });

      return successResponse(res, null, "下载次数更新成功");
    } catch (error) {
      logger.error("更新下载次数失败:", error);
      return errorResponse(res, 500, "更新下载次数失败", null);
    }
  }

  // 回滚事务
  async exitTransaction(queryRunner: any) {
    try {
      // 检查事务是否活跃
      if (queryRunner && queryRunner.isTransactionActive) {
        // 回滚事务
        await queryRunner.rollbackTransaction();
      }
    } catch (error) {
      logger.error('回滚事务失败:', error);
    } finally {
      // 释放查询运行器资源
      if (queryRunner) {
        await queryRunner.release();
      }
      logger.error('回滚事务成功!');
    }
  }
}