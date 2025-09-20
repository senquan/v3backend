import { Router } from "express";
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateRequest } from "../middlewares/validation.middleware";
import { body, param, query } from "express-validator";
import {
  getList,
  getDetail,
  create,
  update,
  deleteBulletin,
  batchDelete,
  getByType,
  publish,
  archive
} from "../controllers/bulletin.controller";

const router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 获取公告列表
router.get("/", [
  query("page").optional().isInt({ min: 1 }).withMessage("页码必须是大于0的整数"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("每页数量必须是1-100之间的整数"),
  query("keyword").optional().isString().withMessage("关键词必须是字符串"),
  validateRequest
], getList);

// 按类型获取公告列表
router.get("/type/:type", [
  query("page").optional().isInt({ min: 1 }).withMessage("页码必须是大于0的整数"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("每页数量必须是1-100之间的整数"),
  query("status").optional().isIn(["draft", "published", "archived"]).withMessage("公告状态无效"),
  validateRequest
], getByType);

// 获取公告详情
router.get("/:id", [
  param("id").isInt({ min: 1 }).withMessage("公告ID必须是大于0的整数"),
  validateRequest
], getDetail);

// 创建公告
router.post("/", [
  body("title")
    .notEmpty()
    .withMessage("标题不能为空")
    .isLength({ max: 200 })
    .withMessage("标题长度不能超过200个字符"),
  body("content")
    .notEmpty()
    .withMessage("内容不能为空"),
  body("type")
    .optional()
    .isInt({ min: 1, max: 3 })
    .withMessage("公告类型无效"),
  body("status")
    .optional()
    .isInt({ min: 0, max: 2 })
    .withMessage("公告状态无效"),
  body("priority")
    .optional()
    .isInt({ min: 0, max: 2 })
    .withMessage("优先级必须是0-2之间的整数"),
  body("is_pinned")
    .optional()
    .isBoolean()
    .withMessage("置顶状态必须是布尔值"),
  body("published_at")
    .optional()
    .isISO8601()
    .withMessage("发布时间格式无效"),
  body("expired_at")
    .optional()
    .isISO8601()
    .withMessage("过期时间格式无效"),
  body("attachment_url")
    .optional()
    .isURL()
    .withMessage("附件URL格式无效")
    .isLength({ max: 500 })
    .withMessage("附件URL长度不能超过500个字符"),
  body("attachment_name")
    .optional()
    .isString()
    .withMessage("附件名称必须是字符串")
    .isLength({ max: 100 })
    .withMessage("附件名称长度不能超过100个字符"),
  body("remark")
    .optional()
    .isString()
    .withMessage("备注必须是字符串"),
  validateRequest
], create);

// 更新公告
router.put("/:id", [
  param("id").isInt({ min: 1 }).withMessage("公告ID必须是大于0的整数"),
  body("title")
    .optional()
    .notEmpty()
    .withMessage("标题不能为空")
    .isLength({ max: 200 })
    .withMessage("标题长度不能超过200个字符"),
  body("content")
    .optional()
    .notEmpty()
    .withMessage("内容不能为空"),
  body("type")
    .optional()
    .isInt({ min: 1, max: 3 })
    .withMessage("公告类型无效"),
  body("status")
    .optional()
    .isInt({ min: 0, max: 2 })
    .withMessage("公告状态无效"),
  body("priority")
    .optional()
    .isInt({ min: 0, max: 2 })
    .withMessage("优先级必须是0-2之间的整数"),
  body("is_pinned")
    .optional()
    .isBoolean()
    .withMessage("置顶状态必须是布尔值"),
  body("published_at")
    .optional()
    .isISO8601()
    .withMessage("发布时间格式无效"),
  body("expired_at")
    .optional()
    .isISO8601()
    .withMessage("过期时间格式无效"),
  body("attachment_url")
    .optional()
    .isURL()
    .withMessage("附件URL格式无效")
    .isLength({ max: 500 })
    .withMessage("附件URL长度不能超过500个字符"),
  body("attachment_name")
    .optional()
    .isString()
    .withMessage("附件名称必须是字符串")
    .isLength({ max: 100 })
    .withMessage("附件名称长度不能超过100个字符"),
  body("remark")
    .optional()
    .isString()
    .withMessage("备注必须是字符串"),
  validateRequest
], update);

// 发布公告
router.patch("/:id/publish", [
  param("id").isInt({ min: 1 }).withMessage("公告ID必须是大于0的整数"),
  validateRequest
], publish);

// 归档公告
router.patch("/:id/archive", [
  param("id").isInt({ min: 1 }).withMessage("公告ID必须是大于0的整数"),
  validateRequest
], archive);

// 删除公告
router.delete("/:id", [
  param("id").isInt({ min: 1 }).withMessage("公告ID必须是大于0的整数"),
  validateRequest
], deleteBulletin);

// 批量删除公告
router.delete("/", [
  body("ids")
    .isArray({ min: 1 })
    .withMessage("请提供要删除的公告ID列表")
    .custom((ids) => {
      if (!ids.every((id: any) => Number.isInteger(Number(id)) && Number(id) > 0)) {
        throw new Error("所有ID必须是大于0的整数");
      }
      return true;
    }),
  validateRequest
], batchDelete);

export default router;