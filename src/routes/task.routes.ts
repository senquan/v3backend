import { Router } from 'express';
import taskController from '../controllers/task.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();

// 验证规则
const createTaskValidation = [
  body('title')
    .notEmpty()
    .withMessage('任务标题不能为空')
    .isLength({ max: 200 })
    .withMessage('任务标题长度不能超过200个字符'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('任务描述长度不能超过1000个字符'),
  body('type')
    .isInt({ min: 1, max: 7 })
    .withMessage('任务类型必须是1-7之间的整数'),
  body('priority')
    .optional()
    .isInt({ min: 1, max: 3 })
    .withMessage('优先级必须是1-3之间的整数'),
  body('start_time')
    .optional()
    .isISO8601()
    .withMessage('开始时间格式不正确'),
  body('end_time')
    .optional()
    .isISO8601()
    .withMessage('结束时间格式不正确'),
  body('expected_participants')
    .optional()
    .isInt({ min: 0 })
    .withMessage('预计参与人数必须是非负整数'),
  body('task_items')
    .optional()
    .isArray()
    .withMessage('任务项必须是数组格式'),
  body('task_items.*.title')
    .if(body('task_items').exists())
    .notEmpty()
    .withMessage('任务项标题不能为空'),
  body('task_items.*.item_type')
    .if(body('task_items').exists())
    .isInt({ min: 1, max: 7 })
    .withMessage('任务项类型必须是1-7之间的整数'),
  body('assignments')
    .optional()
    .isArray()
    .withMessage('任务分配必须是数组格式'),
  body('assignments.*.assignment_type')
    .if(body('assignments').exists())
    .isInt({ min: 1, max: 4 })
    .withMessage('分配类型必须是1-4之间的整数')
];

const updateTaskValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('任务ID必须是正整数'),
  body('title')
    .optional()
    .notEmpty()
    .withMessage('任务标题不能为空')
    .isLength({ max: 200 })
    .withMessage('任务标题长度不能超过200个字符'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('任务描述长度不能超过1000个字符'),
  body('type')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('任务类型必须是1-7之间的整数'),
  body('priority')
    .optional()
    .isInt({ min: 1, max: 3 })
    .withMessage('优先级必须是1-3之间的整数'),
  body('start_time')
    .optional()
    .isISO8601()
    .withMessage('开始时间格式不正确'),
  body('end_time')
    .optional()
    .isISO8601()
    .withMessage('结束时间格式不正确')
];

const getTasksValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('页码必须是正整数'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量必须是1-100之间的整数'),
  query('type')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('任务类型必须是1-7之间的整数'),
  query('status')
    .optional()
    .isInt({ min: 0, max: 4 })
    .withMessage('任务状态必须是0-4之间的整数'),
  query('priority')
    .optional()
    .isInt({ min: 1, max: 3 })
    .withMessage('优先级必须是1-3之间的整数')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID必须是正整数')
];

const batchDeleteValidation = [
  body('ids')
    .isArray({ min: 1 })
    .withMessage('请提供要删除的ID列表'),
  body('ids.*')
    .isInt({ min: 1 })
    .withMessage('ID必须是正整数')
];

// 路由定义

/**
 * @route GET /api/tasks
 * @desc 获取任务列表
 * @access Private
 */
router.get('/', 
  authenticateToken,
  getTasksValidation,
  validateRequest,
  taskController.getTasks.bind(taskController)
);

/**
 * @route GET /api/tasks/:id
 * @desc 获取任务详情
 * @access Private
 */
router.get('/:id',
  authenticateToken,
  idValidation,
  validateRequest,
  taskController.getTaskById.bind(taskController)
);

/**
 * @route POST /api/tasks
 * @desc 创建任务
 * @access Private
 */
router.post('/',
  authenticateToken,
  createTaskValidation,
  validateRequest,
  taskController.createTask.bind(taskController)
);

/**
 * @route PUT /api/tasks/:id
 * @desc 更新任务
 * @access Private
 */
router.put('/:id',
  authenticateToken,
  updateTaskValidation,
  validateRequest,
  taskController.updateTask.bind(taskController)
);

/**
 * @route DELETE /api/tasks/:id
 * @desc 删除任务
 * @access Private
 */
router.delete('/:id',
  authenticateToken,
  idValidation,
  validateRequest,
  taskController.deleteTask.bind(taskController)
);

/**
 * @route POST /api/tasks/batch-delete
 * @desc 批量删除任务
 * @access Private
 */
router.post('/batch-delete',
  authenticateToken,
  batchDeleteValidation,
  validateRequest,
  taskController.batchDeleteTasks.bind(taskController)
);

/**
 * @route POST /api/tasks/:id/publish
 * @desc 发布任务
 * @access Private
 */
router.post('/:id/publish',
  authenticateToken,
  idValidation,
  validateRequest,
  taskController.publishTask.bind(taskController)
);

export default router;