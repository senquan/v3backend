import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Ticket } from '../models/ticket.model';
import { TicketComment } from '../models/ticket-comment.model';
import { TicketAttachment } from '../models/ticket-attachment.model';
import { TicketDepartment } from '../models/ticket-department.model';
import { TicketConfirmation } from '../models/ticket-confirmation.model';
import { Role } from '../models/role.model';
import { Staff } from '../models/staff.model';
import { Department } from '../models/department.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { NotificationService } from '../services/notification.service';

export class TicketController {
  // 创建工单
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { title, content, ticketType, priority, productId, orderId, storeName, trackId, assigneeId, assigneeType, departmentIds } = req.body;
      const userId = (req as any).user?.id;

      if (!title || !content || !ticketType) {
        return errorResponse(res, 400, '标题、内容和工单类型不能为空', null);
      }
      if (assigneeId && assigneeType === 'user') {
        const assignee = await AppDataSource.getRepository(Staff).findOne({
          where: {
            id: assigneeId,
            isDeleted: 0
          }
        })
        if (!assignee) {
          return errorResponse(res, 400, '指定的处理人不存在', null);
        }
      }

      const ticket = new Ticket();
      ticket.title = title;
      ticket.content = content;
      ticket.ticketType = Number(ticketType);
      ticket.priority = priority || 2; // 默认中等优先级
      ticket.status = 1; // 待处理
      ticket.creatorId = userId;
      
      // 根据指派类型设置不同的字段
      if (assigneeType === 'user') {
        if (assigneeId) ticket.assigneeId = assigneeId;
      } else if (assigneeType === 'department') {
        // 多部门：departmentIds 是数组，不设置 departmentId，用中间表
        // departmentIds 在保存工单后处理
      }
      
      ticket.assigneeType = assigneeType || null;
      
      if (productId) ticket.productId = productId;
      if (orderId) ticket.orderId = orderId;
      if (storeName && (ticket.ticketType === 1 || ticket.ticketType === 2)) ticket.related = storeName;
      if (trackId && (ticket.ticketType === 4)) ticket.related = trackId;

      // 保存工单
      const savedTicket = await AppDataSource.getRepository(Ticket).save(ticket);
      
      // 如果是多部门指派，保存工单-部门关联，并创建确认记录
      if (assigneeType === 'department' && departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
        // 获取各部门下的员工用户ID
        const allUserIds: number[] = [];
        for (const deptId of departmentIds) {
          // 查询部门下所有 Staff，通过 Staff.userId 获取用户
          const staffs = await AppDataSource.getRepository(Staff)
            .createQueryBuilder('staff')
            .where('staff.departmentId = :deptId', { deptId })
            .andWhere('staff.isDeleted = 0')
            .andWhere('staff.status < 4')
            .getMany();
          
          for (const staff of staffs) {
            logger.info(`Staff: id=${staff.id}, userId=${staff.userId}, name=${staff.name}`);
            if (staff.userId && !allUserIds.includes(staff.userId)) {
              allUserIds.push(staff.userId);
            }
          }
        }
        
        logger.info(`部门工单确认: 部门 ${departmentIds} 下找到 ${allUserIds.length} 个用户: ${allUserIds}`);
        
        // 如果没有找到任何用户，返回错误
        if (allUserIds.length === 0) {
          return errorResponse(res, 400, '指定部门下没有可分配的员工', null);
        }
        
        // 为每个员工创建确认记录（未确认状态）
        const ticketRepository = AppDataSource.getRepository(Ticket);
        savedTicket.totalConfirmations = allUserIds.length;
        savedTicket.confirmedCount = 0;
        await ticketRepository.save(savedTicket);
        
        for (const deptId of departmentIds) {
          const ticketDept = new TicketDepartment();
          ticketDept.ticketId = savedTicket.id;
          ticketDept.departmentId = Number(deptId);
          await AppDataSource.getRepository(TicketDepartment).save(ticketDept);
        }
        
        // 创建确认记录
        for (const userId of allUserIds) {
          const confirmation = new TicketConfirmation();
          confirmation.ticketId = savedTicket.id;
          confirmation.userId = userId;
          const savedConfirmation = await AppDataSource.getRepository(TicketConfirmation).save(confirmation);
          logger.info(`创建确认记录: ticketId=${savedConfirmation.ticketId}, userId=${savedConfirmation.userId}`);
        }
      }
      
      // 创建系统评论，记录工单创建
      const comment = new TicketComment();
      comment.ticketId = savedTicket.id;
      comment.userId = userId;
      comment.content = '工单已创建，等待处理';
      await AppDataSource.getRepository(TicketComment).save(comment);

      // 如果指定了处理人（用户），创建待办通知
      if (savedTicket.assigneeId) {
        const notificationService = new NotificationService();
        await notificationService.createTicketTodoNotification(savedTicket);
      }
      
      // 如果是部门工单，为所有确认人创建通知
      if (assigneeType === 'department' && departmentIds && Array.isArray(departmentIds)) {
        const confirmationRepository = AppDataSource.getRepository(TicketConfirmation);
        const confirmations = await confirmationRepository.find({
          where: { ticketId: savedTicket.id }
        });
        
        const notificationService = new NotificationService();
        for (const confirmation of confirmations) {
          await notificationService.createNotification({
            title: `新工单待处理：${savedTicket.title}`,
            description: `工单指派给部门，需要您确认收到`,
            avatar: '',
            extra: `#${savedTicket.id}`,
            status: 'warning',
            type: 'todo',
            userId: confirmation.userId,
            targetUrl: `/ticket/detail/${savedTicket.id}`,
            actionType: 'ticket_department_assigned',
            actionData: {
              ticketId: savedTicket.id,
              ticketType: savedTicket.ticketType,
              priority: savedTicket.priority
            }
          });
        }
        logger.info(`部门工单 ${savedTicket.id} 通知创建成功，共 ${confirmations.length} 人`);
      }

      return successResponse(res, savedTicket, '工单创建成功');
    } catch (error) {
      logger.error('创建工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新工单
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { title, content, ticketType, priority, productId, orderId, storeName, trackId, remark } = req.body;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      
      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ 
        where: { id: Number(id), isDeleted: 0 } 
      });
      
      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }
      
      // 检查权限：只有管理员、客服或工单创建者可以更新工单
      if (!userRoles.includes('ADMIN') && !userRoles.includes('SUPPORT') && ticket.creatorId !== userId) {
        return errorResponse(res, 403, '无权更新此工单', null);
      }
      
      // 已关闭或已取消的工单不能更新
      if (ticket.status === 4 || ticket.status === 5) {
        return errorResponse(res, 400, '工单已关闭或取消，不能更新', null);
      }
      
      // 记录更新前的字段值
      const oldValues: any = {};
      const newValues: any = {};
      
      // 更新标题
      if (title !== undefined) {
        if (!title.trim()) {
          return errorResponse(res, 400, '标题不能为空', null);
        }
        oldValues.title = ticket.title;
        newValues.title = title;
        ticket.title = title;
      }
      
      // 更新内容
      if (content !== undefined) {
        if (!content.trim()) {
          return errorResponse(res, 400, '内容不能为空', null);
        }
        oldValues.content = ticket.content;
        newValues.content = content;
        ticket.content = content;
      }
      
      // 更新工单类型
      if (ticketType !== undefined) {
        const validTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
        if (!validTypes.includes(Number(ticketType))) {
          return errorResponse(res, 400, '无效的工单类型', null);
        }
        oldValues.ticketType = ticket.ticketType;
        newValues.ticketType = Number(ticketType);
        ticket.ticketType = Number(ticketType);
      }
      
      // 更新优先级
      if (priority !== undefined) {
        const validPriorities = [1, 2, 3, 4, 5]; // 1-日常，2-一般，3-紧急，4-加急，5-特急
        if (!validPriorities.includes(Number(priority))) {
          return errorResponse(res, 400, '无效的优先级', null);
        }
        oldValues.priority = ticket.priority;
        newValues.priority = Number(priority);
        ticket.priority = Number(priority);
      }
      
      // 更新产品ID
      if (productId !== undefined) {
        oldValues.productId = ticket.productId;
        newValues.productId = productId || null;
        ticket.productId = productId || null;
      }
      
      // 更新订单ID
      if (orderId !== undefined) {
        oldValues.orderId = ticket.orderId;
        newValues.orderId = orderId || null;
        ticket.orderId = orderId || null;
      }
      
      // 根据工单类型更新related字段
      if (storeName !== undefined && (ticket.ticketType === 1 || ticket.ticketType === 2)) {
        oldValues.related = ticket.related;
        newValues.related = storeName;
        ticket.related = storeName;
      }
      
      if (trackId !== undefined && ticket.ticketType === 4) {
        oldValues.related = ticket.related;
        newValues.related = trackId;
        ticket.related = trackId;
      }
      
      // 更新备注
      if (remark !== undefined) {
        oldValues.remark = ticket.remark;
        newValues.remark = remark || null;
        ticket.remark = remark || null;
      }
      
      // 保存更新后的工单
      await ticketRepository.save(ticket);
      
      // 创建系统评论记录变更
      if (Object.keys(oldValues).length > 0) {
        const changeDetails = [];
        for (const [field, newValue] of Object.entries(newValues)) {
          const oldValue = oldValues[field];
          if (oldValue !== newValue) {
            // 将数值类型的代码转换为可读文本
            let oldValueStr = String(oldValue);
            let newValueStr = String(newValue);
            
            if (field === 'ticketType') {
              const typeMap: Record<number, string> = {1: '咨询', 2: '投诉', 3: '售后', 4: '建议'};
              oldValueStr = typeMap[oldValue] || oldValueStr;
              newValueStr = typeMap[newValue as number] || newValueStr;
            } else if (field === 'priority') {
              const priorityMap: Record<number, string> = {1: '日常', 2: '一般', 3: '紧急', 4: '加急', 5: '特急'};
              oldValueStr = priorityMap[oldValue] || oldValueStr;
              newValueStr = priorityMap[newValue as number] || newValueStr;
            } else if (field === 'status') {
              const statusMap: Record<number, string> = {1: '待处理', 2: '处理中', 3: '待确认', 4: '已关闭', 5: '已取消'};
              oldValueStr = statusMap[oldValue] || oldValueStr;
              newValueStr = statusMap[newValue as number] || newValueStr;
            }
            
            changeDetails.push(`${field}: ${oldValueStr} → ${newValueStr}`);
          }
        }
        
        if (changeDetails.length > 0) {
          const comment = new TicketComment();
          comment.ticketId = Number(id);
          comment.userId = userId;
          comment.content = `工单信息已更新: ${changeDetails.join(', ')}`;
          await AppDataSource.getRepository(TicketComment).save(comment);
        }
      }
      
      // 获取完整更新后的工单信息
      const updatedTicket = await ticketRepository
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.creator', 'creator')
        .leftJoinAndSelect('creator.staff', 'creatorStaff')
        .leftJoinAndSelect('ticket.assignee', 'assignee')
        .where('ticket.id = :id', { id: Number(id) })
        .getOne();
      
      return successResponse(res, updatedTicket, '工单更新成功');
    } catch (error) {
      logger.error('更新工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取工单列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, status, ticketType, priority, keyword, departmentId } = req.query;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      
      const queryBuilder = AppDataSource.getRepository(Ticket)
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.creator', 'creator')
        .leftJoinAndSelect('ticket.assignee', 'assignee')
        .leftJoinAndSelect('ticket.order', 'order')
        .leftJoinAndSelect('ticket.department', 'department')
        .where('ticket.isDeleted = :isDeleted', { isDeleted: 0 });
      
      // 非管理员只能看到自己创建的、分配给自己的、或需要自己确认的工单
      if (!userRoles.includes('ADMIN')) {
        // 使用子查询检查确认记录
        queryBuilder.andWhere(
          '(ticket.creatorId = :userId OR assignee.userId = :userId OR ticket.id IN (SELECT ticket_id FROM ticket_confirmations WHERE user_id = :userId))',
          { userId }
        );
      } 
      
      // 添加筛选条件
      if (status) {
        queryBuilder.andWhere('ticket.status = :status', { status });
      }
      
      if (ticketType) {
        queryBuilder.andWhere('ticket.ticketType = :ticketType', { ticketType });
      }
      
      if (priority) {
        queryBuilder.andWhere('ticket.priority = :priority', { priority });
      }
      
      if (keyword) {
        queryBuilder.andWhere('(ticket.title LIKE :keyword OR ticket.content LIKE :keyword)', 
          { keyword: `%${keyword}%` });
      }

      if (departmentId) {
        queryBuilder.andWhere('ticket.departmentId = :departmentId', { departmentId });
      }
      
      // 计算总数
      const total = await queryBuilder.getCount();
      
      // 获取分页数据
      const tickets = await queryBuilder
        .orderBy('ticket.priority', 'DESC')
        .addOrderBy('ticket.updatedAt', 'DESC')
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getMany();
      
      return successResponse(res, {
        tickets,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取工单列表成功');
    } catch (error) {
      logger.error('获取工单列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取可指派用户列表
  async getAssigneeList(req: Request, res: Response): Promise<Response> {
    const userRoles = (req as any).userRoles || [];
    const isAdmin = userRoles.includes('ADMIN');
    const isOp = userRoles.some((role: any) => role.includes('OP'));
    const userPlatforms = (req as any).accessPlatforms || [];
    try {

      // 如果不是管理员，需要筛选出支持的平台
      const assignees = await AppDataSource.getRepository(Staff)
        .createQueryBuilder('staff')
        .innerJoinAndSelect('staff.user', 'user')
        .leftJoinAndSelect('user.roles', 'roles')
        .select(['staff.id', 'staff.name', 'user.id', 'user.name', 'roles.id', 'roles.name', 'roles.code'])
        .where('user.status = :status', { status: 1 })
        .getMany();

      // 筛选出支持用户的平台
      if (!isAdmin) {
        // 查询角色包含平台资源
        const rolesWithPlatforms = await AppDataSource.getRepository(Role)
          .createQueryBuilder('role')
          .leftJoinAndSelect('role.platforms', 'platforms')
          .select(['role.id', 'role.name', 'role.code', 'platforms.platformId'])
          .getMany();
        
        const roleMap = new Map<number, Role>();
        rolesWithPlatforms.forEach(role => {
          roleMap.set(role.id, role);
        })

        assignees.forEach(assignee => {
          if (assignee.user !== null) {
            assignee.user.roles = assignee.user.roles?.filter(role => roleMap.get(role.id)?.platforms?.some(p => userPlatforms.includes(p.platformId))) || [];
          }
        })
      }
      const filteredAssignees = assignees.filter(assignee => assignee.user?.roles?.length || 0 > 0);

      const targetRole = new Set<string>();
      if (userRoles.some((role: any) => role.includes('WM'))) {
        targetRole.add('OP')
      }
      if (userRoles.some((role: any) => role.includes('GD'))) {
        targetRole.add('OP')
      }
      if (userRoles.some((role: any) => role.includes('CS'))) {
        targetRole.add('AS')
        targetRole.add('OP')
      }

      // 将用户按角色分组
      const flatAssignees: { id: number, role: string, name: string }[] = [];
      const addedUser = new Set<string>();
      filteredAssignees.forEach(assignee => {
        if (assignee.user !== null) {
          assignee.user.roles?.forEach(role => {
            if (!isAdmin && !isOp && !targetRole.has(role.code.substring(0 , 2))) {
              return;
            }
            if (!addedUser.has(role.code + assignee.id)) {
              flatAssignees.push({
                id: assignee.id,
                role: role.code,
                name: assignee.name || assignee.user?.name || assignee.user?.username || ''
              });
            }
            addedUser.add(role.code + assignee.id);
          })
        }
      })
      
      return successResponse(res, {
        assignees: flatAssignees,
      }, '获取可指派用户列表成功');
    } catch (error) {
      logger.error('获取可指派用户列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取部门-用户树形列表（用于级联选择）
  async getDepartmentUserTree(req: Request, res: Response): Promise<Response> {
    try {
      // const userRoles = (req as any).userRoles || [];
      // const isAdmin = userRoles.includes('ADMIN');

      // 查询所有启用且未删除的部门
      const departments = await AppDataSource.getRepository(Department)
        .createQueryBuilder('dept')
        .where('dept.isActive = 1')
        .andWhere('dept.isDeleted = 0')
        .orderBy('dept.sort', 'ASC')
        .addOrderBy('dept.name', 'ASC')
        .getMany();

      // 查询所有员工及其用户信息
      const staffs = await AppDataSource.getRepository(Staff)
        .createQueryBuilder('staff')
        .innerJoinAndSelect('staff.user', 'user')
        .leftJoinAndSelect('staff.dept', 'dept')
        .where('user.status = 1')
        .andWhere('staff.isDeleted = 0')
        .getMany();

      // 构建部门-用户树形结构
      const tree: any[] = [];

      // 首先添加"全部部门"选项（显示所有用户）
      const allUsers: any[] = [];
      for (const staff of staffs) {
        allUsers.push({
          label: `${staff.name || staff.user?.username || ''} (${staff.dept?.name || '无部门'})`,
          value: staff.id,
        });
      }
      if (allUsers.length > 0) {
        tree.push({
          label: '全部部门',
          value: 0,
          children: allUsers,
        });
      }

      // 按部门分组用户
      const deptUserMap = new Map<number, any[]>();
      for (const staff of staffs) {
        const deptId = staff.dept?.id;
        if (!deptId) continue;
        if (!deptUserMap.has(deptId)) {
          deptUserMap.set(deptId, []);
        }
        deptUserMap.get(deptId)!.push({
          label: staff.name || staff.user?.username || '',
          value: staff.id,
        });
      }

      // 遍历部门，构建树形结构
      for (const dept of departments) {
        if (dept.parentId) continue; // 跳过子部门，后续会处理
        const users = deptUserMap.get(dept.id) || [];
        if (users.length === 0) continue; // 该部门没有员工，跳过

        const node: any = {
          label: dept.name,
          value: dept.id,
          children: users,
        };

        // 递归处理子部门
        const addChildren = (parentId: number, nodes: any[]) => {
          const children = departments.filter(d => d.parentId === parentId);
          for (const child of children) {
            const childUsers = deptUserMap.get(child.id) || [];
            if (childUsers.length > 0) {
              nodes.push({
                label: child.name,
                value: child.id,
                children: childUsers,
              });
              // 继续递归
              const childNodes = nodes[nodes.length - 1];
              addChildren(child.id, childNodes.children);
            }
          }
        };
        addChildren(dept.id, node.children);

        tree.push(node);
      }

      return successResponse(res, { tree }, '获取部门-用户树形列表成功');
    } catch (error) {
      logger.error('获取部门-用户树形列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取工单详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      
      const ticket = await AppDataSource.getRepository(Ticket)
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.creator', 'creator')
        .leftJoinAndSelect('creator.staff', 'creatorStaff')
        .leftJoinAndSelect('ticket.assignee', 'assignee')
        .leftJoinAndSelect('ticket.comments', 'comments', 'comments.isDeleted = 0')
        .leftJoinAndSelect('comments.user', 'commentUser')
        .leftJoinAndSelect('ticket.attachments', 'attachments', 'attachments.isDeleted = 0')
        .where('ticket.id = :id', { id })
        .andWhere('ticket.isDeleted = 0')
        .getOne();
      
      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }
      
      // 检查权限：管理员、客服、工单创建者、或需要确认的用户可以查看
      const isCreator = ticket.creatorId === userId;
      const isSupport = userRoles.includes('ADMIN') || userRoles.some((role: any) => role.includes('CS'));
      
      logger.info(`工单详情权限检查: ticketId=${id}, userId=${userId}, roles=${userRoles}, isCreator=${isCreator}, isSupport=${isSupport}, assigneeType=${ticket.assigneeType}`);
      
      // 对于部门工单，检查用户是否是确认人之一
      let isConfirmationUser = false;
      if (ticket.assigneeType === 'department') {
        const confirmation = await AppDataSource.getRepository(TicketConfirmation)
          .findOne({ where: { ticketId: Number(id), userId } });
        isConfirmationUser = !!confirmation;
        logger.info(`部门工单确认人检查: ticketId=${id}, userId=${userId}, isConfirmationUser=${isConfirmationUser}`);
      }
      
      if (!isSupport && !isCreator && !isConfirmationUser) {
        logger.warn(`工单详情权限拒绝: ticketId=${id}, userId=${userId}`);
        return errorResponse(res, 403, '无权查看此工单', null);
      }
      
      // 过滤内部评论
      if (!isSupport) {
        ticket.comments = ticket.comments.filter(comment => !comment.isInternal);
      }
      
      return successResponse(res, ticket, '获取工单详情成功');
    } catch (error) {
      logger.error('获取工单详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除工单
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      
      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ 
        where: { id: Number(id), isDeleted: 0 } 
      });
      
      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }

      // 只有管理员和工单创建者可以删除工单
      if (!userRoles.includes('ADMIN') && ticket.creatorId !== userId) {
        return errorResponse(res, 403, '无权删除此工单', null);
      }
      
      // 软删除工单
      ticket.isDeleted = 1;
      await ticketRepository.save(ticket);
      
      return successResponse(res, null, '工单删除成功');
    } catch (error) {
      logger.error('删除工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }


  // 分配工单
  async assign(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { assigneeId, content } = req.body;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      
      // 只有管理员和客服可以分配工单
      if (!userRoles.includes('ADMIN') && !userRoles.includes('SUPPORT')) {
        return errorResponse(res, 403, '无权分配工单', null);
      }
      
      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ 
        where: { id: Number(id), isDeleted: 0 } 
      });
      
      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }
      
      // 检查被分配人是否存在
      if (assigneeId) {
        const staffRepository = AppDataSource.getRepository(Staff);
        const assignee = await staffRepository.findOne({ 
          where: { id: assigneeId, isDeleted: 0 } 
        });
        
        if (!assignee) {
          return errorResponse(res, 404, '被分配人不存在', null);
        }
      }
      
      // 记录原分配人和状态
      const oldAssigneeId = ticket.assigneeId;
      const oldStatus = ticket.status;
      
      // 更新工单分配信息
      ticket.assigneeId = assigneeId;
      // ticket.assignedAt = assigneeId ? new Date() : null;
      
      // 如果分配了处理人，状态改为处理中
      if (assigneeId && ticket.status === 1) {
        ticket.status = 2;
      }
      
      await ticketRepository.save(ticket);
      
      // 添加分配评论
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = content || (assigneeId ? '工单已分配' : '工单分配已取消');
      await AppDataSource.getRepository(TicketComment).save(comment);
      
      // 创建通知
      const notificationService = new NotificationService();
      
      // 如果分配给了新的处理人，发送待办通知
      if (assigneeId && assigneeId !== oldAssigneeId) {
        await notificationService.createTicketTodoNotification(ticket);
      }
      
      // 如果状态发生变化，创建状态变更通知
      if (oldStatus !== ticket.status) {
        await notificationService.createTicketStatusChangeNotification(ticket, oldStatus, ticket.status);
      }
      
      return successResponse(res, ticket, '工单分配成功');
    } catch (error) {
      logger.error('分配工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 处理工单
  async process(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { content, status } = req.body;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      
      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ 
        where: { id: Number(id), isDeleted: 0 } 
      });
      
      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }
      
      // 检查是否是分配给自己的工单或者是管理员
      if (!userRoles.includes('ADMIN') && ticket.assigneeId !== userId) {
        return errorResponse(res, 403, '无权处理此工单', null);
      }
      
      // 记录原状态
      const oldStatus = ticket.status;
      
      // 更新工单状态
      if (status) {
        ticket.status = status;
      } else {
        ticket.status = 3; // 默认更新为待确认状态
      }
      
      ticket.processedAt = new Date();
      await ticketRepository.save(ticket);
      
      // 添加处理评论
      if (content) {
        const comment = new TicketComment();
        comment.ticketId = Number(id);
        comment.userId = userId;
        comment.content = content;
        comment.isInternal = req.body.isInternal || false;
        await AppDataSource.getRepository(TicketComment).save(comment);
      }
      
      // 如果状态发生变化，创建状态变更通知
      if (oldStatus !== ticket.status) {
        const notificationService = new NotificationService();
        await notificationService.createTicketStatusChangeNotification(ticket, oldStatus, ticket.status);
      }
      
      return successResponse(res, ticket, '工单处理成功');
    } catch (error) {
      logger.error('处理工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 确认工单
  async confirm(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = (req as any).user?.id;
      
      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ 
        where: { id: Number(id), isDeleted: 0 } 
      });
      
      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }
      
      // 只有工单创建者可以确认工单
      if (ticket.creatorId !== userId) {
        return errorResponse(res, 403, '只有工单创建者可以确认工单', null);
      }
      
      // 只有待确认状态的工单可以被确认
      if (ticket.status !== 3) {
        return errorResponse(res, 400, '只有待确认状态的工单可以被确认', null);
      }
      
      // 记录原状态
      const oldStatus = ticket.status;
      
      // 更新工单状态为已关闭
      ticket.status = 4;
      ticket.closedAt = new Date();
      await ticketRepository.save(ticket);
      
      // 添加确认评论
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = content || '用户已确认工单处理结果';
      await AppDataSource.getRepository(TicketComment).save(comment);
      
      // 创建状态变更通知
      const notificationService = new NotificationService();
      await notificationService.createTicketStatusChangeNotification(ticket, oldStatus, ticket.status);
      
      return successResponse(res, ticket, '工单确认成功');
    } catch (error) {
      logger.error('确认工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 关闭工单
  async close(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      
      // 只有管理员和客服可以强制关闭工单
      if (!userRoles.includes('ADMIN') && !userRoles.includes('SUPPORT')) {
        return errorResponse(res, 403, '无权关闭工单', null);
      }
      
      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ 
        where: { id: Number(id), isDeleted: 0 } 
      });
      
      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }
      
      // 已关闭或已取消的工单不能再次关闭
      if (ticket.status === 4 || ticket.status === 5) {
        return errorResponse(res, 400, '工单已经是关闭或取消状态', null);
      }
      
      // 记录原状态
      const oldStatus = ticket.status;
      
      // 更新工单状态为已关闭
      ticket.status = 4;
      ticket.closedAt = new Date();
      await ticketRepository.save(ticket);
      
      // 添加关闭评论
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = reason || '管理员已关闭工单';
      await AppDataSource.getRepository(TicketComment).save(comment);
      
      // 如果状态发生变化，创建状态变更通知
      if (oldStatus !== ticket.status) {
        const notificationService = new NotificationService();
        await notificationService.createTicketStatusChangeNotification(ticket, oldStatus, ticket.status);
      }
      
      return successResponse(res, ticket, '工单关闭成功');
    } catch (error) {
      logger.error('关闭工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 取消工单
  async cancel(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user?.id;
      
      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ 
        where: { id: Number(id), isDeleted: 0 } 
      });
      
      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }
      
      // 只有工单创建者或管理员可以取消工单
      const userRoles = (req as any).userRoles || [];
      if (ticket.creatorId !== userId && !userRoles.includes('ADMIN')) {
        return errorResponse(res, 403, '无权取消此工单', null);
      }
      
      // 已关闭或已取消的工单不能再次取消
      if (ticket.status === 4 || ticket.status === 5) {
        return errorResponse(res, 400, '工单已经是关闭或取消状态', null);
      }
      
      // 记录原状态
      const oldStatus = ticket.status;
      
      // 更新工单状态为已取消
      ticket.status = 5;
      await ticketRepository.save(ticket);
      
      // 添加取消评论
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = reason || '用户已取消工单';
      await AppDataSource.getRepository(TicketComment).save(comment);
      
      // 创建状态变更通知
      const notificationService = new NotificationService();
      await notificationService.createTicketStatusChangeNotification(ticket, oldStatus, ticket.status);
      
      return successResponse(res, ticket, '工单取消成功');
    } catch (error) {
      logger.error('取消工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 添加评论
  async addComment(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { content, isInternal, isDone, fileList } = req.body;
      const userId = (req as any).user?.id;
      // const userRoles = (req as any).userRoles || [];
      
      if (!content) {
        return errorResponse(res, 400, '评论内容不能为空', null);
      }
      
      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ 
        where: { id: Number(id), isDeleted: 0 }
      });
      
      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }
      
      // 已关闭或已取消的工单不能添加评论
      if (ticket.status === 4 || ticket.status === 5) {
        return errorResponse(res, 400, '工单已关闭或取消，不能添加评论', null);
      }
      
      // 添加评论
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = content;
      comment.isInternal = isInternal || false;

      
      const savedComment = await AppDataSource.getRepository(TicketComment).save(comment);

      if (Array.isArray(fileList) && fileList.length > 0) {
        // 创建评论附件
        for (const filePath of fileList) {
          const attachment = new TicketAttachment();
          attachment.ticketId = Number(id);
          attachment.userId = userId;
          attachment.commentId = savedComment.id;
          attachment.filename = filePath.substring(filePath.lastIndexOf('/') + 1);
          attachment.path = filePath;
          attachment.mimetype = filePath.substring(filePath.lastIndexOf('.') + 1);
          attachment.size = 0;
          await AppDataSource.getRepository(TicketAttachment).save(attachment);
        }
      }
      
      if (isDone) {
        const staffRepository = AppDataSource.getRepository(Staff);
        const staff = await staffRepository.findOne({ 
          where: { userId: ticket.creatorId, isDeleted: 0 }
        });
        if (!staff) {
          return errorResponse(res, 404, '员工不存在', null);
        }
        await ticketRepository.update({ id: Number(id) }, {
          status: 3,
          assignee: staff
        });
      }

      // 如果是客户添加的评论，更新工单状态为待处理
      // if (ticket.creatorId === userId && ticket.status === 3) {
      //   ticket.status = 2; // 更新为处理中
      //   await ticketRepository.save(ticket);
      // }
      
      return successResponse(res, savedComment, '评论添加成功');
    } catch (error) {
      logger.error('添加评论失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 上传附件
  async uploadAttachment(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      
      if (!req.file) {
        return errorResponse(res, 400, '未上传文件', null);
      }
      
      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ 
        where: { id: Number(id), isDeleted: 0 } 
      });
      
      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }
      
      // 已关闭或已取消的工单不能上传附件
      if (ticket.status === 4 || ticket.status === 5) {
        return errorResponse(res, 400, '工单已关闭或取消，不能上传附件', null);
      }
      
      // 检查权限：只有管理员、客服或工单创建者可以上传附件
      if (!userRoles.includes('ADMIN') && !userRoles.includes('SUPPORT') && ticket.creatorId !== userId) {
        return errorResponse(res, 403, '无权上传附件', null);
      }
      
      // 保存附件信息
      const attachment = new TicketAttachment();
      attachment.ticketId = Number(id);
      attachment.userId = userId;
      attachment.filename = req.file.originalname;
      attachment.path = req.file.path;
      attachment.mimetype = req.file.mimetype;
      attachment.size = req.file.size;
      
      const savedAttachment = await AppDataSource.getRepository(TicketAttachment).save(attachment);
      
      // 添加上传附件的评论
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = `上传了附件: ${req.file.originalname}`;
      await AppDataSource.getRepository(TicketComment).save(comment);
      
      return successResponse(res, savedAttachment, '附件上传成功');
    } catch (error) {
      logger.error('上传附件失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 收到确认（内部工单）
  async receipt(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }

      if (ticket.status !== 1) {
        return errorResponse(res, 400, '只有待处理状态的工单可以确认收到', null);
      }

      // 内部工单类型检查
      const internalTypes = [11, 12, 13, 14];
      if (!internalTypes.includes(ticket.ticketType)) {
        return errorResponse(res, 400, '只有内部工单可以确认收到', null);
      }

      ticket.status = 2; // 处理中
      ticket.receiptAt = new Date();
      ticket.receiptBy = userId;
      await ticketRepository.save(ticket);

      // 创建系统评论
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = '已确认收到工单';
      await AppDataSource.getRepository(TicketComment).save(comment);

      return successResponse(res, ticket, '已确认收到');
    } catch (error) {
      logger.error('确认收到工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 回复工单（内部工单）
  async reply(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = (req as any).user?.id;

      if (!content) {
        return errorResponse(res, 400, '回复内容不能为空', null);
      }

      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }

      if (ticket.status === 4 || ticket.status === 5) {
        return errorResponse(res, 400, '工单已关闭或取消，不能回复', null);
      }

      // 添加回复评论
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = content;
      comment.isInternal = false;
      await AppDataSource.getRepository(TicketComment).save(comment);

      // 如果是待处理状态，自动转为处理中
      if (ticket.status === 1) {
        ticket.status = 2;
        ticket.receiptAt = ticket.receiptAt || new Date();
        ticket.receiptBy = ticket.receiptBy || userId;
      }

      // 如果当前是处理中，回复后转为待确认
      if (ticket.status === 2) {
        ticket.status = 3;
        ticket.processedAt = new Date();
      }

      await ticketRepository.save(ticket);

      return successResponse(res, comment, '回复成功');
    } catch (error) {
      logger.error('回复工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 确认收到（部门工单确认进度）
  async acknowledgeReceipt(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      logger.info(`确认收到请求: ticketId=${id}, userId=${userId}`);

      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }

      // 只允许指派给部门的工单使用此接口
      if (ticket.assigneeType !== 'department') {
        return errorResponse(res, 400, '此工单不是部门工单', null);
      }

      // 检查用户是否是工单的确认人之一
      const confirmationRepository = AppDataSource.getRepository(TicketConfirmation);
      
      // 获取所有确认记录
      const allConfirmations = await confirmationRepository.find({
        where: { ticketId: Number(id) }
      });
      logger.info(`工单 ${id} 的所有确认记录: ${JSON.stringify(allConfirmations.map(c => ({ userId: c.userId })))}`);
      
      const existingConfirmation = await confirmationRepository.findOne({
        where: { ticketId: Number(id), userId }
      });

      logger.info(`当前用户 ${userId} 的确认记录: ${existingConfirmation ? '存在' : '不存在'}`);

      if (!existingConfirmation) {
        return errorResponse(res, 403, '您不是此工单的接收人', null);
      }

      // 如果已确认，返回错误
      if (existingConfirmation.confirmedAt) {
        return errorResponse(res, 400, '您已确认收到此工单', null);
      }

      // 更新确认状态
      existingConfirmation.confirmedAt = new Date();
      await confirmationRepository.save(existingConfirmation);

      // 更新工单确认进度
      ticket.confirmedCount = (ticket.confirmedCount || 0) + 1;
      await ticketRepository.save(ticket);

      // 创建系统评论
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = '已确认收到工单';
      await AppDataSource.getRepository(TicketComment).save(comment);

      return successResponse(res, {
        confirmedCount: ticket.confirmedCount,
        totalConfirmations: ticket.totalConfirmations,
        allConfirmed: ticket.confirmedCount >= ticket.totalConfirmations
      }, '已确认收到');
    } catch (error) {
      logger.error('确认收到失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取确认进度
  async getConfirmationProgress(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];

      const ticket = await AppDataSource.getRepository(Ticket).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!ticket) {
        return errorResponse(res, 404, '工单不存在', null);
      }

      if (ticket.assigneeType !== 'department') {
        return errorResponse(res, 400, '此工单不是部门工单', null);
      }

      // 检查权限：只有工单发起人、管理员/客服、或需要确认的用户可以查看
      const isCreator = ticket.creatorId === userId;
      const isSupport = userRoles.includes('ADMIN') || userRoles.some((role: any) => role.includes('CS'));
      
      let isConfirmationUser = false;
      if (!isCreator && !isSupport) {
        const confirmation = await AppDataSource.getRepository(TicketConfirmation)
          .findOne({ where: { ticketId: Number(id), userId } });
        isConfirmationUser = !!confirmation;
        if (!isConfirmationUser) {
          return errorResponse(res, 403, '无权查看此工单确认进度', null);
        }
      }

      // 获取所有确认记录
      const confirmations = await AppDataSource.getRepository(TicketConfirmation)
        .createQueryBuilder('conf')
        .innerJoinAndSelect('conf.user', 'user')
        .leftJoinAndSelect('user.staff', 'staff')
        .leftJoinAndSelect('staff.dept', 'dept')
        .where('conf.ticketId = :ticketId', { ticketId: Number(id) })
        .orderBy('dept.name', 'ASC')
        .addOrderBy('staff.name', 'ASC')
        .getMany();

      const progress = confirmations.map(c => ({
        userId: c.userId,
        userName: c.user?.name || c.user?.username || '',
        staffName: c.user?.staff?.name || '',
        department: c.user?.staff?.dept?.name || '',
        confirmed: !!c.confirmedAt,
        confirmedAt: c.confirmedAt
      }));

      return successResponse(res, {
        total: ticket.totalConfirmations,
        confirmed: ticket.confirmedCount,
        progress,
        allConfirmed: ticket.confirmedCount >= ticket.totalConfirmations
      }, '获取确认进度成功');
    } catch (error) {
      logger.error('获取确认进度失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}