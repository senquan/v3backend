import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { KnowledgeBaseController } from '../controllers/knowledge-base.controller';

const router = Router();
const kbController = new KnowledgeBaseController();

// 应用认证中间件
router.use(authMiddleware);

// 获取知识库列表
router.get('/list', kbController.getList);

// 获取知识库选项（下拉用）
router.get('/options', kbController.getOptions);

// 获取指定知识库的文档列表
router.get('/:kbId/docs', kbController.getDocList);

// 创建文档（自动触发向量化）
router.post('/:kbId/docs', kbController.createDoc.bind(kbController));

// 重新处理文档（重新切片 + 向量化）
router.post('/docs/:id/reprocess', kbController.reprocessDoc.bind(kbController));

// 查看文档详情
router.get('/docs/:id', kbController.getDocDetail);

// 删除文档（同时清理向量）
router.delete('/docs/:id', kbController.deleteDoc.bind(kbController));

// 创建知识库
router.post('/', kbController.create.bind(kbController));

// 更新知识库
router.put('/:id', kbController.update.bind(kbController));

// 删除知识库
router.delete('/:id', kbController.delete);

export default router;
