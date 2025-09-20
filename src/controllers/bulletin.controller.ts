import { Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { Bulletin } from "../models/bulletin.model";
import { User } from "../models/user.model";
import { successResponse, errorResponse } from "../utils/response";
import { Like, In, IsNull, Not } from "typeorm";

const bulletinRepository = AppDataSource.getRepository(Bulletin);
const userRepository = AppDataSource.getRepository(User);

/**
 * 获取公告列表
 */
export async function getList(req: Request, res: Response) {
  try {
    const {
      page = 1,
      pageSize = 20,
      keyword = "",
      type = "",
      status = "",
      priority = "",
      is_pinned = "",
      creator_id = "",
      start_date = "",
      end_date = ""
    } = req.query;

    // 构建查询条件
    const queryBuilder = bulletinRepository.createQueryBuilder("bulletin")
      .leftJoinAndSelect("bulletin.creator", "creator")
      .leftJoinAndSelect("bulletin.updater", "updater")
      .leftJoinAndSelect("bulletin.publisher", "publisher")
      .where("bulletin.is_deleted = :is_deleted", { is_deleted: false });

    // 关键词搜索
    if (keyword) {
      queryBuilder.andWhere(
        "(bulletin.title LIKE :keyword OR bulletin.content LIKE :keyword OR bulletin.remark LIKE :keyword)",
        { keyword: `%${keyword}%` }
      );
    }

    // 类型筛选
    if (type) {
      queryBuilder.andWhere("bulletin.type = :type", { type });
    }

    // 状态筛选
    if (status) {
      queryBuilder.andWhere("bulletin.status = :status", { status });
    }

    // 优先级筛选
    if (priority !== "") {
      queryBuilder.andWhere("bulletin.priority = :priority", { priority: parseInt(priority as string) });
    }

    // 置顶筛选
    if (is_pinned !== "") {
      queryBuilder.andWhere("bulletin.is_pinned = :is_pinned", { is_pinned: is_pinned === "true" });
    }

    // 创建者筛选
    if (creator_id) {
      queryBuilder.andWhere("bulletin.creator_id = :creator_id", { creator_id: parseInt(creator_id as string) });
    }

    // 日期范围筛选
    if (start_date) {
      queryBuilder.andWhere("bulletin.created_at >= :start_date", { start_date });
    }
    if (end_date) {
      queryBuilder.andWhere("bulletin.created_at <= :end_date", { end_date });
    }

    // 排序：置顶优先，然后按优先级降序，最后按创建时间降序
    queryBuilder.orderBy("bulletin.is_pinned", "DESC")
      .addOrderBy("bulletin.priority", "DESC")
      .addOrderBy("bulletin.created_at", "DESC");

    // 计算分页
    const pageNum = Number(page);
    const pageSizeNum = Number(pageSize);
    const skip = (pageNum - 1) * pageSizeNum;
    
    const [bulletins, total] = await queryBuilder
      .skip(skip)
      .take(pageSizeNum)
      .getManyAndCount();

    const result = {
      bulletins,
      total,
      page: pageNum,
      pageSize: pageSizeNum
    }

    return successResponse(res, result, "获取公告列表成功");
  } catch (error) {
    console.error("获取公告列表失败:", error);
    return errorResponse(res, 500, "获取公告列表失败");
  }
}

/**
 * 获取公告详情
 */
export async function getDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "公告ID无效");
    }

    const bulletin = await bulletinRepository.findOne({
      where: { id: parseInt(id), is_deleted: false },
      relations: ["creator", "updater", "publisher"]
    });

    if (!bulletin) {
      return errorResponse(res, 404, "公告不存在");
    }

    // 增加阅读次数
    await bulletinRepository.update(bulletin.id, {
      read_count: bulletin.read_count + 1
    });

    bulletin.read_count += 1;

    return successResponse(res, bulletin, "获取公告详情成功");
  } catch (error) {
    console.error("获取公告详情失败:", error);
    return errorResponse(res, 500, "获取公告详情失败");
  }
}

/**
 * 创建公告
 */
export async function create(req: Request, res: Response) {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const {
      title,
      content,
      type = 1,
      status = 0,
      priority = 0,
      is_pinned = false,
      published_at,
      expired_at,
      attachment_url,
      attachment_name,
      remark
    } = req.body;

    const user = (req as any).user;

    // 验证必填字段
    if (!title || !content) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 400, "标题和内容不能为空");
    }

    // 验证优先级
    if (priority < 0 || priority > 2) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 400, "优先级必须在0-2之间");
    }

    // 创建公告
    const bulletin = new Bulletin();
    bulletin.title = title;
    bulletin.content = content;
    bulletin.type = Number(type);
    bulletin.status = Number(status);
    bulletin.priority = priority;
    bulletin.is_pinned = is_pinned;
    bulletin.published_at = published_at ? new Date(published_at) : null;
    bulletin.expired_at = expired_at ? new Date(expired_at) : null;
    bulletin.attachment_url = attachment_url;
    bulletin.attachment_name = attachment_name;
    bulletin.remark = remark;
    bulletin.creator_id = user.id;
    bulletin.updater_id = user.id;
    bulletin.created_at = new Date();
    bulletin.updated_at = new Date();

    // 如果状态为已发布，设置发布者和发布时间
    if (status === 1) {
      bulletin.publisher_id = user.id;
      if (!bulletin.published_at) {
        bulletin.published_at = new Date();
      }
    }

    const savedBulletin = await queryRunner.manager.save(bulletin);

    await queryRunner.commitTransaction();
    return successResponse(res, savedBulletin, "创建公告成功");
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("创建公告失败:", error);
    return errorResponse(res, 500, "创建公告失败");
  } finally {
    await queryRunner.release();
  }
}

/**
 * 更新公告
 */
export async function update(req: Request, res: Response) {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { id } = req.params;
    const {
      title,
      content,
      type,
      status,
      priority,
      is_pinned,
      published_at,
      expired_at,
      attachment_url,
      attachment_name,
      remark
    } = req.body;

    const user = (req as any).user;

    if (!id || isNaN(parseInt(id))) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 400, "公告ID无效");
    }

    const bulletin = await queryRunner.manager.findOne(Bulletin, {
      where: { id: parseInt(id), is_deleted: false }
    });

    if (!bulletin) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 404, "公告不存在");
    }

    // 验证字段
    if (title !== undefined && !title) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 400, "标题不能为空");
    }

    if (content !== undefined && !content) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 400, "内容不能为空");
    }

    if (type !== undefined) {
      if (type < 1 || type > 3) {
        await queryRunner.rollbackTransaction();
        return errorResponse(res, 400, "公告类型无效");
      }
    }

    if (status !== undefined) {
      if (status < 0 || status > 2) {
        await queryRunner.rollbackTransaction();
        return errorResponse(res, 400, "公告状态无效");
      }
    }

    if (priority !== undefined && (priority < 0 || priority > 2)) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 400, "优先级必须在0-2之间");
    }

    // 更新字段
    const updateData: any = {
      updater_id: user.id
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned;
    if (published_at !== undefined) updateData.published_at = published_at ? new Date(published_at) : null;
    if (expired_at !== undefined) updateData.expired_at = expired_at ? new Date(expired_at) : null;
    if (attachment_url !== undefined) updateData.attachment_url = attachment_url;
    if (attachment_name !== undefined) updateData.attachment_name = attachment_name;
    if (remark !== undefined) updateData.remark = remark;
    bulletin.updated_at = new Date();

    // 如果状态变为已发布，设置发布者和发布时间
    if (status === 1 && bulletin.status !== 1) {
      updateData.publisher_id = user.id;
      if (!updateData.published_at) {
        updateData.published_at = new Date();
      }
    }

    await queryRunner.manager.update(Bulletin, bulletin.id, updateData);

    await queryRunner.commitTransaction();

    // 获取更新后的公告信息
    const result = await bulletinRepository.findOne({
      where: { id: bulletin.id },
      relations: ["creator", "updater", "publisher"]
    });

    return successResponse(res, result, "更新公告成功");
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("更新公告失败:", error);
    return errorResponse(res, 500, "更新公告失败");
  } finally {
    await queryRunner.release();
  }
}

/**
 * 删除公告
 */
export async function deleteBulletin(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "公告ID无效");
    }

    const bulletin = await bulletinRepository.findOne({
      where: { id: parseInt(id), is_deleted: false }
    });

    if (!bulletin) {
      return errorResponse(res, 404, "公告不存在");
    }

    // 软删除
    await bulletinRepository.update(bulletin.id, {
      is_deleted: true,
      updater_id: user.id
    });

    return successResponse(res, null, "删除公告成功");
  } catch (error) {
    console.error("删除公告失败:", error);
    return errorResponse(res, 500, "删除公告失败");
  }
}

/**
 * 批量删除公告
 */
export async function batchDelete(req: Request, res: Response) {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { ids } = req.body;
    const user = (req as any).user;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 400, "请提供要删除的公告ID列表");
    }

    // 验证所有ID都是有效的数字
    const validIds = ids.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));
    if (validIds.length === 0) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 400, "没有有效的公告ID");
    }

    // 检查公告是否存在
    const bulletins = await queryRunner.manager.find(Bulletin, {
      where: { id: In(validIds), is_deleted: false }
    });

    if (bulletins.length === 0) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 404, "没有找到要删除的公告");
    }

    // 批量软删除
    await queryRunner.manager.update(Bulletin, 
      { id: In(bulletins.map(b => b.id)) },
      { is_deleted: true, updater_id: user.id }
    );

    await queryRunner.commitTransaction();

    return successResponse(res, {
      deleted_count: bulletins.length,
      deleted_ids: bulletins.map(b => b.id)
    }, `成功删除${bulletins.length}个公告`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("批量删除公告失败:", error);
    return errorResponse(res, 500, "批量删除公告失败");
  } finally {
    await queryRunner.release();
  }
}

/**
 * 按类型获取公告列表
 */
export async function getByType(req: Request, res: Response) {
  try {
    const { type } = req.params;
    const {
      page = 1,
      limit = 10,
      status = 1
    } = req.query;

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    // 验证类型
    const validTypes = ["normal", "urgent", "notice"];
    if (!validTypes.includes(type)) {
      return errorResponse(res, 400, "公告类型无效");
    }

    const queryBuilder = bulletinRepository.createQueryBuilder("bulletin")
      .leftJoinAndSelect("bulletin.creator", "creator")
      .leftJoinAndSelect("bulletin.publisher", "publisher")
      .where("bulletin.is_deleted = :is_deleted", { is_deleted: false })
      .andWhere("bulletin.type = :type", { type })
      .andWhere("bulletin.status = :status", { status })
      .orderBy("bulletin.is_pinned", "DESC")
      .addOrderBy("bulletin.priority", "DESC")
      .addOrderBy("bulletin.created_at", "DESC");

    const [list, total] = await queryBuilder
      .skip(offset)
      .take(pageSize)
      .getManyAndCount();

    const result = {
      list,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    };

    return successResponse(res, result, `获取${type}类型公告列表成功`);
  } catch (error) {
    console.error("按类型获取公告列表失败:", error);
    return errorResponse(res, 500, "按类型获取公告列表失败");
  }
}

/**
 * 发布公告
 */
export async function publish(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "公告ID无效");
    }

    const bulletin = await bulletinRepository.findOne({
      where: { id: parseInt(id), is_deleted: false }
    });

    if (!bulletin) {
      return errorResponse(res, 404, "公告不存在");
    }

    if (bulletin.status === 1) {
      return errorResponse(res, 400, "公告已经发布");
    }

    // 更新状态为已发布
    await bulletinRepository.update(bulletin.id, {
      status: 1,
      publisher_id: user.id,
      published_at: new Date(),
      updated_at: new Date(),
      updater_id: user.id
    });

    // 获取更新后的公告信息
    const result = await bulletinRepository.findOne({
      where: { id: bulletin.id },
      relations: ["creator", "updater", "publisher"]
    });

    return successResponse(res, result, "发布公告成功");
  } catch (error) {
    console.error("发布公告失败:", error);
    return errorResponse(res, 500, "发布公告失败");
  }
}

/**
 * 归档公告
 */
export async function archive(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "公告ID无效");
    }

    const bulletin = await bulletinRepository.findOne({
      where: { id: parseInt(id), is_deleted: false }
    });

    if (!bulletin) {
      return errorResponse(res, 404, "公告不存在");
    }

    if (bulletin.status === 2) {
      return errorResponse(res, 400, "公告已经归档");
    }

    // 更新状态为已归档
    await bulletinRepository.update(bulletin.id, {
      status: 2,
      updater_id: user.id
    });

    // 获取更新后的公告信息
    const result = await bulletinRepository.findOne({
      where: { id: bulletin.id },
      relations: ["creator", "updater", "publisher"]
    });

    return successResponse(res, result, "归档公告成功");
  } catch (error) {
    console.error("归档公告失败:", error);
    return errorResponse(res, 500, "归档公告失败");
  }
}