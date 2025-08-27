import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { StudyPlanController } from "../controllers/study.controller";

const router = Router();
const studyPlanController = new StudyPlanController();

// 应用认证中间件
router.use(authMiddleware);

// 获取自学计划列表
router.get("/list", studyPlanController.getList);

// 获取自学计划详情
router.get("/:id", studyPlanController.getDetail);

// 创建自学计划
router.post("/", studyPlanController.create);

// 更新自学计划
router.put("/:id", studyPlanController.update);

// 删除自学计划
router.delete("/:id", studyPlanController.delete);

// 批量删除自学计划
router.post("/batch/delete", studyPlanController.batchDelete);

// 开始学习计划
router.post("/:id/start", studyPlanController.startPlan);

// 完成学习计划
router.post("/:id/complete", studyPlanController.completePlan);

// 更新学习进度
router.put("/:id/progress", studyPlanController.updateProgress);

export default router;