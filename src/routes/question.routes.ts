import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { QuestionController } from "../controllers/question.controller";

const router = Router();
const questionController = new QuestionController();

// 应用认证中间件
router.use(authMiddleware);

// 获取题库列表
router.get("/list", questionController.getList);

// 获取题目详情
router.get("/:id", questionController.getDetail);

// 创建题目
router.post("/", questionController.create);

// 更新题目
router.put("/:id", questionController.update);

// 删除题目
router.delete("/:id", questionController.delete);

// 批量删除题目
router.post("/batch-delete", questionController.batchDelete);

// 批量导入题目
router.post("/import", questionController.import);

export default router;