import { Request, Response } from 'express';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { KnowledgeBase } from '../models/knowledge-base.model';
import { KbDocument, DocStatus } from '../models/kb-document.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'http://localhost:8000';
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || '';
const internalHeaders = INTERNAL_TOKEN ? { 'X-Internal-Token': INTERNAL_TOKEN } : {};

export class KnowledgeBaseController {
  // 获取知识库列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { keyword, status, page = 1, pageSize = 12 } = req.query;

      const queryBuilder = AppDataSource.getRepository(KnowledgeBase)
        .createQueryBuilder('kb')
        .where('kb.isDeleted = :isDeleted', { isDeleted: 0 });

      if (keyword) {
        queryBuilder.andWhere(
          '(kb.name LIKE :keyword OR kb.description LIKE :keyword)',
          { keyword: `%${keyword}%` }
        );
      }

      if (status !== undefined && status !== '') {
        queryBuilder.andWhere('kb.status = :status', { status: Number(status) });
      }

      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;

      const [items, total] = await queryBuilder
        .orderBy('kb.id', 'DESC')
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();

      const docCounts = await AppDataSource.getRepository(KbDocument)
        .createQueryBuilder('doc')
        .select('doc.knowledge_base_id', 'kbId')
        .addSelect('COUNT(*)', 'count')
        .where('doc.isDeleted = 0')
        .groupBy('doc.knowledge_base_id')
        .getRawMany();
      const docCountMap = new Map(docCounts.map(r => [Number(r.kbId), Number(r.count)]));

      const list = items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        icon: item.icon,
        qaCount: 0,
        docCount: docCountMap.get(item.id) || 0,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));

      return successResponse(res, { items: list, total }, '获取知识库列表成功');
    } catch (error) {
      logger.error('获取知识库列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取知识库选项（下拉用）
  async getOptions(req: Request, res: Response): Promise<Response> {
    try {
      const items = await AppDataSource.getRepository(KnowledgeBase).find({
        where: { isDeleted: 0, status: 1 },
        select: ['id', 'name'],
        order: { id: 'ASC' }
      });

      return successResponse(res, items, '获取知识库选项成功');
    } catch (error) {
      logger.error('获取知识库选项失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建知识库
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { name, description, icon, status } = req.body;

      if (!name) {
        return errorResponse(res, 400, '知识库名称不能为空', null);
      }

      const existing = await AppDataSource.getRepository(KnowledgeBase).findOne({
        where: { name, isDeleted: 0 }
      });
      if (existing) {
        return errorResponse(res, 400, '知识库名称已存在', null);
      }

      const kb = new KnowledgeBase();
      kb.name = name;
      kb.description = description || '';
      kb.icon = icon || '📦';
      kb.status = status !== undefined ? status : 1;

      const saved = await AppDataSource.getRepository(KnowledgeBase).save(kb);

      return successResponse(res, saved, '创建知识库成功');
    } catch (error) {
      logger.error('创建知识库失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新知识库
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name, description, icon, status } = req.body;

      if (!name) {
        return errorResponse(res, 400, '知识库名称不能为空', null);
      }

      const kb = await AppDataSource.getRepository(KnowledgeBase).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      if (!kb) {
        return errorResponse(res, 404, '知识库不存在', null);
      }

      if (name !== kb.name) {
        const existing = await AppDataSource.getRepository(KnowledgeBase).findOne({
          where: { name, isDeleted: 0 }
        });
        if (existing) {
          return errorResponse(res, 400, '知识库名称已存在', null);
        }
      }

      kb.name = name;
      if (description !== undefined) kb.description = description;
      if (icon !== undefined) kb.icon = icon;
      if (status !== undefined) kb.status = status;

      const updated = await AppDataSource.getRepository(KnowledgeBase).save(kb);

      return successResponse(res, updated, '更新知识库成功');
    } catch (error) {
      logger.error('更新知识库失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除知识库（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const kb = await AppDataSource.getRepository(KnowledgeBase).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      if (!kb) {
        return errorResponse(res, 404, '知识库不存在', null);
      }

      kb.isDeleted = 1;
      await AppDataSource.getRepository(KnowledgeBase).save(kb);

      return successResponse(res, null, '删除知识库成功');
    } catch (error) {
      logger.error('删除知识库失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // ========== 文档管理 ==========

  // 获取指定知识库的文档列表
  async getDocList(req: Request, res: Response): Promise<Response> {
    try {
      const { kbId } = req.params;
      const { keyword, status, page = 1, pageSize = 20 } = req.query;

      const queryBuilder = AppDataSource.getRepository(KbDocument)
        .createQueryBuilder('doc')
        .where('doc.knowledgeBaseId = :kbId', { kbId: Number(kbId) })
        .andWhere('doc.isDeleted = :isDeleted', { isDeleted: 0 });

      if (keyword) {
        queryBuilder.andWhere('doc.title LIKE :keyword', { keyword: `%${keyword}%` });
      }
      if (status) {
        queryBuilder.andWhere('doc.status = :status', { status });
      }

      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;

      const [items, total] = await queryBuilder
        .orderBy('doc.id', 'DESC')
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();

      return successResponse(res, { items, total, page: pageNum, pageSize: pageSizeNum }, '获取文档列表成功');
    } catch (error) {
      logger.error('获取文档列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建文档 + 自动触发 ai-gateway 处理
  async createDoc(req: Request, res: Response): Promise<Response> {
    try {
      const { kbId } = req.params;
      const { title, content } = req.body;

      if (!title) {
        return errorResponse(res, 400, '文档标题不能为空', null);
      }
      if (!content) {
        return errorResponse(res, 400, '文档内容不能为空', null);
      }

      const kb = await AppDataSource.getRepository(KnowledgeBase).findOne({
        where: { id: Number(kbId), isDeleted: 0 }
      });
      if (!kb) {
        return errorResponse(res, 404, '知识库不存在', null);
      }

      const doc = new KbDocument();
      doc.knowledgeBaseId = Number(kbId);
      doc.title = title;
      doc.content = content;
      doc.charCount = content.length;
      doc.status = DocStatus.PROCESSING;

      const saved = await AppDataSource.getRepository(KbDocument).save(doc);

      // 异步调用 ai-gateway 进行切片 + 向量化
      this._processDocument(Number(kbId), saved).catch(err => {
        logger.error(`文档处理失败 doc_id=${saved.id}:`, err.message);
      });

      return successResponse(res, saved, '创建文档成功，正在处理中');
    } catch (error) {
      logger.error('创建文档失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 重新处理文档（重新切片 + 向量化）
  async reprocessDoc(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const doc = await AppDataSource.getRepository(KbDocument).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      if (!doc) {
        return errorResponse(res, 404, '文档不存在', null);
      }

      doc.status = DocStatus.PROCESSING;
      await AppDataSource.getRepository(KbDocument).save(doc);

      // 先清理旧向量，再重新处理
      this._reprocessDocument(doc.knowledgeBaseId, doc).catch(err => {
        logger.error(`文档重新处理失败 doc_id=${doc.id}:`, err.message);
      });

      return successResponse(res, null, '文档重新处理中');
    } catch (error) {
      logger.error('重新处理文档失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 查看文档详情
  async getDocDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const doc = await AppDataSource.getRepository(KbDocument).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      if (!doc) {
        return errorResponse(res, 404, '文档不存在', null);
      }

      return successResponse(res, doc, '获取文档详情成功');
    } catch (error) {
      logger.error('获取文档详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除文档（软删除）+ 清理向量
  async deleteDoc(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const doc = await AppDataSource.getRepository(KbDocument).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      if (!doc) {
        return errorResponse(res, 404, '文档不存在', null);
      }

      doc.isDeleted = 1;
      await AppDataSource.getRepository(KbDocument).save(doc);

      // 异步清理 ai-gateway 中的向量
      this._removeDocumentVectors(doc.knowledgeBaseId, doc.id).catch(err => {
        logger.error(`清理文档向量失败 doc_id=${doc.id}:`, err.message);
      });

      return successResponse(res, null, '删除文档成功');
    } catch (error) {
      logger.error('删除文档失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // ========== 内部方法：ai-gateway 文档处理 ==========

  private async _processDocument(kbId: number, doc: KbDocument): Promise<void> {
    try {
      const resp = await axios.post(`${AI_GATEWAY_URL}/knowledge/ingest`, {
        kb_id: String(kbId),
        doc_id: doc.id,
        title: doc.title,
        content: doc.content,
      }, { timeout: 120000, headers: internalHeaders });

      if (resp.data?.status === 'ok') {
        doc.status = DocStatus.PARSED;
        await AppDataSource.getRepository(KbDocument).save(doc);
        logger.info(`文档处理完成 doc_id=${doc.id}, chunks=${resp.data.chunks}`);
      } else {
        throw new Error(resp.data?.detail || 'ai-gateway 返回异常');
      }
    } catch (error: any) {
      doc.status = DocStatus.ERROR;
      await AppDataSource.getRepository(KbDocument).save(doc);
      logger.error(`文档向量化失败 doc_id=${doc.id}:`, error.message);
    }
  }

  private async _reprocessDocument(kbId: number, doc: KbDocument): Promise<void> {
    try {
      // 先清理旧向量
      await this._removeDocumentVectors(kbId, doc.id);

      // 重新摄入
      const resp = await axios.post(`${AI_GATEWAY_URL}/knowledge/ingest`, {
        kb_id: String(kbId),
        doc_id: doc.id,
        title: doc.title,
        content: doc.content,
      }, { timeout: 120000, headers: internalHeaders });

      if (resp.data?.status === 'ok') {
        doc.status = DocStatus.PARSED;
        await AppDataSource.getRepository(KbDocument).save(doc);
        logger.info(`文档重新处理完成 doc_id=${doc.id}, chunks=${resp.data.chunks}`);
      } else {
        throw new Error(resp.data?.detail || 'ai-gateway 返回异常');
      }
    } catch (error: any) {
      doc.status = DocStatus.ERROR;
      await AppDataSource.getRepository(KbDocument).save(doc);
      logger.error(`文档重新处理失败 doc_id=${doc.id}:`, error.message);
    }
  }

  private async _removeDocumentVectors(kbId: number, docId: number): Promise<void> {
    try {
      await axios.post(`${AI_GATEWAY_URL}/knowledge/remove-doc`, {
        kb_id: String(kbId),
        doc_id: docId,
      }, { timeout: 30000, headers: internalHeaders });
      logger.info(`文档向量已清理 kb=${kbId}, doc_id=${docId}`);
    } catch (error: any) {
      logger.warn(`清理向量失败(可忽略) kb=${kbId}, doc_id=${docId}: ${error.message}`);
    }
  }
}

