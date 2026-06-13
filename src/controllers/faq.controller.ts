import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { QaPair } from '../models/qa-pair.model';
import { QaPairTag } from '../models/qa-pair-tag.model';
import { Tag, TagType } from '../models/tag.model';
import { KnowledgeBase } from '../models/knowledge-base.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class FaqController {
  // 获取FAQ列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { keyword, knowledgeBaseId, tag, status, page = 1, pageSize = 20 } = req.query;

      const qb = AppDataSource.getRepository(QaPair)
        .createQueryBuilder('qa')
        .where('qa.isDeleted = :isDeleted', { isDeleted: 0 });

      if (keyword) {
        qb.andWhere('(qa.question LIKE :keyword OR qa.answer LIKE :keyword)', { keyword: `%${keyword}%` });
      }
      if (knowledgeBaseId !== undefined && knowledgeBaseId !== '') {
        qb.andWhere('qa.knowledgeBaseId = :knowledgeBaseId', { knowledgeBaseId: Number(knowledgeBaseId) });
      }
      if (status !== undefined && status !== '') {
        qb.andWhere('qa.status = :status', { status: Number(status) });
      }

      // 按标签筛选：先找到含有该tag名称的BUSINESS标签ID，再找关联的qa_pair_id
      if (tag) {
        const tagEntity = await AppDataSource.getRepository(Tag).findOne({
          where: { name: String(tag), type: TagType.BUSINESS, isDeleted: 0 }
        });
        if (tagEntity) {
          const qaPairTags = await AppDataSource.getRepository(QaPairTag).find({
            where: { tagId: tagEntity.id }
          });
          const qaIds = qaPairTags.map(pt => pt.qaPairId);
          if (qaIds.length > 0) {
            qb.andWhere('qa.id IN (:...qaIds)', { qaIds });
          } else {
            qb.andWhere('1 = 0'); // 没有任何匹配
          }
        } else {
          qb.andWhere('1 = 0'); // 标签不存在
        }
      }

      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;

      const [items, total] = await qb
        .orderBy('qa.id', 'DESC')
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();

      // 批量获取关联数据: knowledgeBaseName + tags
      const kbIds = [...new Set(items.map(i => i.knowledgeBaseId))];
      const qaIds = items.map(i => i.id);

      // 知识库名称映射
      const kbMap = new Map<number, string>();
      if (kbIds.length > 0) {
        const kbs = await AppDataSource.getRepository(KnowledgeBase).find({
          where: { id: In(kbIds) },
          select: ['id', 'name']
        });
        kbs.forEach(kb => kbMap.set(kb.id, kb.name));
      }

      // 标签映射
      const tagMap = new Map<number, string[]>();
      if (qaIds.length > 0) {
        const pairTags = await AppDataSource.getRepository(QaPairTag).find({
          where: { qaPairId: In(qaIds) }
        });
        const allTagIds = [...new Set(pairTags.map(pt => pt.tagId))];
        const tagEntities = allTagIds.length > 0
          ? await AppDataSource.getRepository(Tag).find({ where: { id: In(allTagIds), isDeleted: 0 }, select: ['id', 'name'] })
          : [];
        const tagNameMap = new Map(tagEntities.map(t => [t.id, t.name]));

        for (const pt of pairTags) {
          if (!tagMap.has(pt.qaPairId)) tagMap.set(pt.qaPairId, []);
          const name = tagNameMap.get(pt.tagId);
          if (name) tagMap.get(pt.qaPairId)!.push(name);
        }
      }

      const list = items.map(item => ({
        id: item.id,
        knowledgeBaseId: item.knowledgeBaseId,
        knowledgeBaseName: kbMap.get(item.knowledgeBaseId) || '',
        question: item.question,
        answer: item.answer,
        tags: tagMap.get(item.id) || [],
        hitCount: item.hitCount,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));

      return successResponse(res, { items: list, total }, '获取FAQ列表成功');
    } catch (error) {
      logger.error('获取FAQ列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建FAQ
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { knowledgeBaseId, question, answer, tags, status } = req.body;

      if (!question) {
        return errorResponse(res, 400, '问句不能为空', null);
      }
      if (!answer) {
        return errorResponse(res, 400, '回复内容不能为空', null);
      }
      if (!knowledgeBaseId) {
        return errorResponse(res, 400, '请选择所属知识库', null);
      }

      // 校验知识库是否存在
      const kb = await AppDataSource.getRepository(KnowledgeBase).findOne({
        where: { id: Number(knowledgeBaseId), isDeleted: 0 }
      });
      if (!kb) {
        return errorResponse(res, 404, '知识库不存在', null);
      }

      const qa = new QaPair();
      qa.knowledgeBaseId = Number(knowledgeBaseId);
      qa.question = question;
      qa.answer = answer;
      qa.status = status !== undefined ? status : 1;

      const saved = await AppDataSource.getRepository(QaPair).save(qa);

      // 同步标签
      if (tags && Array.isArray(tags) && tags.length > 0) {
        await this.syncTags(saved.id, tags);
      }

      return successResponse(res, saved, '创建FAQ成功');
    } catch (error) {
      logger.error('创建FAQ失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新FAQ
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { knowledgeBaseId, question, answer, tags, status } = req.body;

      if (!question) {
        return errorResponse(res, 400, '问句不能为空', null);
      }
      if (!answer) {
        return errorResponse(res, 400, '回复内容不能为空', null);
      }

      const qa = await AppDataSource.getRepository(QaPair).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      if (!qa) {
        return errorResponse(res, 404, 'FAQ不存在', null);
      }

      if (knowledgeBaseId) {
        qa.knowledgeBaseId = Number(knowledgeBaseId);
      }
      qa.question = question;
      qa.answer = answer;
      if (status !== undefined) qa.status = status;

      const updated = await AppDataSource.getRepository(QaPair).save(qa);

      // 同步标签
      if (tags && Array.isArray(tags)) {
        await this.syncTags(updated.id, tags);
      }

      return successResponse(res, updated, '更新FAQ成功');
    } catch (error) {
      logger.error('更新FAQ失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除FAQ（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const qa = await AppDataSource.getRepository(QaPair).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      if (!qa) {
        return errorResponse(res, 404, 'FAQ不存在', null);
      }

      qa.isDeleted = 1;
      await AppDataSource.getRepository(QaPair).save(qa);

      // 清除标签关联
      await AppDataSource.getRepository(QaPairTag).delete({ qaPairId: qa.id });

      return successResponse(res, null, '删除FAQ成功');
    } catch (error) {
      logger.error('删除FAQ失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取所有BUSINESS类型标签（供前端筛选下拉）
  async getBusinessTags(req: Request, res: Response): Promise<Response> {
    try {
      const tags = await AppDataSource.getRepository(Tag).find({
        where: { type: TagType.BUSINESS, isDeleted: 0 },
        select: ['id', 'name'],
        order: { id: 'ASC' }
      });
      return successResponse(res, tags, '获取业务标签列表成功');
    } catch (error) {
      logger.error('获取业务标签列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 导出FAQ列表
  async exportList(req: Request, res: Response): Promise<Response> {
    try {
      const { knowledgeBaseId } = req.query;

      const qb = AppDataSource.getRepository(QaPair)
        .createQueryBuilder('qa')
        .where('qa.isDeleted = :isDeleted', { isDeleted: 0 });

      if (knowledgeBaseId !== undefined && knowledgeBaseId !== '') {
        qb.andWhere('qa.knowledgeBaseId = :knowledgeBaseId', { knowledgeBaseId: Number(knowledgeBaseId) });
      }

      const items = await qb.orderBy('qa.id', 'ASC').getMany();

      // 获取关联数据
      const kbIds = [...new Set(items.map(i => i.knowledgeBaseId))];
      const qaIds = items.map(i => i.id);

      const kbMap = new Map<number, string>();
      if (kbIds.length > 0) {
        const kbs = await AppDataSource.getRepository(KnowledgeBase).find({ where: { id: In(kbIds) }, select: ['id', 'name'] });
        kbs.forEach(kb => kbMap.set(kb.id, kb.name));
      }

      const tagMap = new Map<number, string[]>();
      if (qaIds.length > 0) {
        const pairTags = await AppDataSource.getRepository(QaPairTag).find({ where: { qaPairId: In(qaIds) } });
        const allTagIds = [...new Set(pairTags.map(pt => pt.tagId))];
        const tagEntities = allTagIds.length > 0
          ? await AppDataSource.getRepository(Tag).find({ where: { id: In(allTagIds), isDeleted: 0 }, select: ['id', 'name'] })
          : [];
        const tagNameMap = new Map(tagEntities.map(t => [t.id, t.name]));
        for (const pt of pairTags) {
          if (!tagMap.has(pt.qaPairId)) tagMap.set(pt.qaPairId, []);
          const name = tagNameMap.get(pt.tagId);
          if (name) tagMap.get(pt.qaPairId)!.push(name);
        }
      }

      const list = items.map(item => ({
        id: item.id,
        knowledgeBaseId: item.knowledgeBaseId,
        knowledgeBaseName: kbMap.get(item.knowledgeBaseId) || '',
        question: item.question,
        answer: item.answer,
        tags: tagMap.get(item.id) || [],
        hitCount: item.hitCount,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));

      return successResponse(res, list, '导出FAQ成功');
    } catch (error) {
      logger.error('导出FAQ失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 同步标签：接收标签名称数组，自动创建不存在的BUSINESS标签
  private async syncTags(qaPairId: number, tagNames: string[]) {
    const tagRepo = AppDataSource.getRepository(Tag);
    const pairTagRepo = AppDataSource.getRepository(QaPairTag);

    // 清除旧的关联
    await pairTagRepo.delete({ qaPairId });

    if (tagNames.length === 0) return;

    // 查找或创建标签
    const tagIds: number[] = [];
    for (const name of tagNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;

      let tag = await tagRepo.findOne({
        where: { name: trimmed, type: TagType.BUSINESS, isDeleted: 0 }
      });
      if (!tag) {
        tag = new Tag();
        tag.name = trimmed;
        tag.type = TagType.BUSINESS;
        tag = await tagRepo.save(tag);
      }
      tagIds.push(tag.id);
    }

    // 创建新关联
    if (tagIds.length > 0) {
      const newPairTags = tagIds.map(tagId => {
        const pt = new QaPairTag();
        pt.qaPairId = qaPairId;
        pt.tagId = tagId;
        return pt;
      });
      await pairTagRepo.save(newPairTags);
    }
  }
}

