import { Router } from "express";
import { TagController } from "../controllers/tag.controller";

const router = Router();
const tagController = new TagController();

// 标签管理路由
router.get("/list", tagController.getList.bind(tagController));
router.get("/all", tagController.getAllTags.bind(tagController));
router.get("/tree", tagController.getTree.bind(tagController));
router.get("/:id", tagController.getDetail.bind(tagController));
router.post("/", tagController.create.bind(tagController));
router.put("/:id", tagController.update.bind(tagController));
router.delete("/:id", tagController.delete.bind(tagController));
router.delete("/group/:id", tagController.deleteGroup.bind(tagController));
router.delete("/batch/delete", tagController.batchDelete.bind(tagController));

export default router;