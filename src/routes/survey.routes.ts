import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { SurveyController } from '../controllers/survey.controller';

const router = Router();
const surveyController = new SurveyController();

// 应用认证中间件
router.use(authMiddleware);

// 获取问卷列表
router.get('/list', surveyController.getList.bind(surveyController));

// 获取问卷详情
router.get('/detail/:id', surveyController.getDetail.bind(surveyController));

// 创建问卷
router.post('/create', surveyController.create.bind(surveyController));

// 更新问卷
router.put('/update/:id', surveyController.update.bind(surveyController));

// 删除问卷
router.delete('/delete/:id', surveyController.delete.bind(surveyController));

// 批量删除问卷
router.post('/batch-delete', surveyController.batchDelete.bind(surveyController));

// 发布问卷
router.put('/publish/:id', surveyController.publish.bind(surveyController));

// 结束问卷
router.put('/end/:id', surveyController.end.bind(surveyController));

// 获取问卷提交记录
router.get('/submissions/:id', surveyController.getSubmissions.bind(surveyController));

export default router;