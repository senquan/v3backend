import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth.middleware'
import { QuotationTemplatesController } from '../controllers/quotation_templates.controller'

const router = Router()
const controller = new QuotationTemplatesController()

// 公开接口：获取模板列表
router.get('/list', controller.getList)
// 公开接口：根据平台和类型获取模板
router.get('/by-platform', controller.getTemplateByPlatform)
// 公开接口：获取详情
router.get('/:id', controller.getDetail)

router.use(authMiddleware)
// 创建模板
router.post('/', controller.create)
// 更新模板
router.put('/:id', controller.update)
// 删除模板
router.delete('/:id', controller.delete)

export default router
