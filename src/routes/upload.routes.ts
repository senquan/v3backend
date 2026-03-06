import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import * as multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { UploadController } from '../controllers/upload.controller';

const router = Router();
const uploadController = new UploadController();

// 应用认证中间件
router.use(authMiddleware);

const storage = multer.diskStorage({
destination: (req, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
},
filename: (req, file, cb) => {
    const randomName = randomBytes(16).toString('hex');
    cb(null, `${randomName}${extname(file.originalname)}`);
}
});

// 文件过滤器
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
allowedMimeTypes.includes(file.mimetype) 
    ? cb(null, true) 
    : cb(null, false);
};

// 创建 multer 实例
const uploadMiddleware = multer.default({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
});

// 单文件上传路由
router.post('/image', uploadMiddleware.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            code: 1,
            message: '未接收到文件'
        });
    }
    try {
        const result = await uploadController.uploadImage(req.file);
        return res.json(result);
    } catch (error) {
        return res.status(500).json({
            code: 1,
            message: '文件上传处理失败'
        });
    }
});

// 多文件上传路由
router.post('/images', uploadMiddleware.array('images', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({
            code: 1,
            message: '未接收到文件'
        });
    }
    const result = uploadController.uploadImages(req.files as Express.Multer.File[]);
    return res.json(result);
});

export default router;