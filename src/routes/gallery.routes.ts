import { Router } from "express";
import { GalleryController } from "../controllers/gallery.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateRequest } from "../middlewares/validation.middleware";
import { body, param, query } from "express-validator";

const router = Router();
const galleryController = new GalleryController();

// 获取图片列表
router.get(
  "/list",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("页码必须是大于0的整数"),
    query("pageSize").optional().isInt({ min: 1, max: 100 }).withMessage("每页数量必须是1-100之间的整数"),
    query("keyword").optional().isString().withMessage("关键词必须是字符串"),
    query("tagIds").optional().isArray().withMessage("标签ID必须是数组"),
    query("fileType").optional().isIn(["image", "video", "document", "audio"]).withMessage("文件类型无效"),
    query("status").optional().isIn([0, 1]).withMessage("状态值无效"),
    query("sortBy").optional().isIn(["createAt", "updateAt", "title", "fileSize", "viewCount", "downloadCount", "sortOrder"]).withMessage("排序字段无效"),
    query("sortOrder").optional().isIn(["ASC", "DESC"]).withMessage("排序方向无效")
  ],
  validateRequest,
  galleryController.getList
);

// 获取图片详情
router.get(
  "/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("图片ID必须是大于0的整数")
  ],
  validateRequest,
  galleryController.getDetail
);

// 创建图片记录
router.post(
  "/",
  authMiddleware,
  [
    body("title").notEmpty().withMessage("标题不能为空").isLength({ max: 255 }).withMessage("标题长度不能超过255个字符"),
    body("description").optional().isLength({ max: 1000 }).withMessage("描述长度不能超过1000个字符"),
    body("fileName").notEmpty().withMessage("文件名不能为空").isLength({ max: 255 }).withMessage("文件名长度不能超过255个字符"),
    body("filePath").notEmpty().withMessage("文件路径不能为空"),
    body("fileUrl").notEmpty().withMessage("文件URL不能为空").isURL().withMessage("文件URL格式无效"),
    body("fileSize").isInt({ min: 0 }).withMessage("文件大小必须是非负整数"),
    body("fileType").isIn(["image", "video", "document", "audio"]).withMessage("文件类型无效"),
    body("mimeType").notEmpty().withMessage("MIME类型不能为空"),
    body("width").optional().isInt({ min: 0 }).withMessage("宽度必须是非负整数"),
    body("height").optional().isInt({ min: 0 }).withMessage("高度必须是非负整数"),
    body("thumbnailUrl").optional().isURL().withMessage("缩略图URL格式无效"),
    body("categoryId").optional().isInt().withMessage("分类ID必须是整数"),
    body("altText").optional().isLength({ max: 255 }).withMessage("替代文本长度不能超过255个字符"),
    body("sortOrder").optional().isInt().withMessage("排序值必须是整数"),
    body("tagIds").optional().isArray().withMessage("标签ID必须是数组")
  ],
  validateRequest,
  galleryController.create
);

// 批量上传图片
router.post(
  "/batch",
  authMiddleware,
  [
    body("category").notEmpty().withMessage("分类不能为空"),
    body("files").isArray({ min: 1 }).withMessage("文件列表不能为空"),
  ],
  galleryController.batchCreate.bind(galleryController)
);

// 更新图片信息
router.put(
  "/:id",
  authMiddleware,
  [
    param("id").isInt({ min: 1 }).withMessage("图片ID必须是大于0的整数"),
    body("title").optional().isLength({ min: 1, max: 255 }).withMessage("标题长度必须在1-255个字符之间"),
    body("description").optional().isLength({ max: 1000 }).withMessage("描述长度不能超过1000个字符"),
    body("categoryId").optional().isInt().withMessage("分类ID必须是整数"),
    body("alt").optional().isLength({ max: 255 }).withMessage("替代文本长度不能超过255个字符"),
    body("sortOrder").optional().isInt().withMessage("排序值必须是整数"),
    body("status").optional().isIn([0, 1]).withMessage("状态值无效"),
    body("tags").optional().isArray().withMessage("标签ID必须是数组")
  ],
  validateRequest,
  galleryController.update
);

// 批量删除图片
router.delete(
  "/batch",
  authMiddleware,
  [
    body("ids").isArray({ min: 1 }).withMessage("ID列表不能为空"),
    body("ids.*").isInt({ min: 1 }).withMessage("每个ID必须是大于0的整数"),
    body("deleteFile").optional().isBoolean().withMessage("删除文件标志必须是布尔值")
  ],
  validateRequest,
  galleryController.batchDelete
);

// 删除图片
router.delete(
  "/:id",
  authMiddleware,
  [
    param("id").isInt({ min: 1 }).withMessage("图片ID必须是大于0的整数"),
    body("deleteFile").optional().isBoolean().withMessage("删除文件标志必须是布尔值")
  ],
  validateRequest,
  galleryController.delete
);

// 获取分类统计
router.get(
  "/stats/category",
  authMiddleware,
  galleryController.getCategoryStats
);

// 获取标签统计
router.get(
  "/stats/tags",
  authMiddleware,
  galleryController.getTagStats
);

// 增加下载次数
router.post(
  "/:id/download",
  [
    param("id").isInt({ min: 1 }).withMessage("图片ID必须是大于0的整数")
  ],
  validateRequest,
  galleryController.incrementDownload
);

export default router;