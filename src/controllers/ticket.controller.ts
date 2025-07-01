import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Ticket } from '../models/ticket.model';
import { TicketComment } from "../models/ticket-comment.model";
import { TicketAttachment } from '../models/ticket-attachment.model';
import { User } from '../models/user.model';
import { Role } from '../models/role.model';
import { Staff } from '../models/staff.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class TicketController {
  // 创建工单
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { title, content, ticketType, priority, productId, orderId, storeName, trackId, assigneeId } = req.body;
      const userId = (req as any).user?.id;

      if (!title || !content || !ticketType) {
        return errorResponse(res, 400, '标题、内容和工单类型不能为空', null);
      }
      if (assigneeId) {
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
      if (assigneeId) ticket.assigneeId = assigneeId;
      
      if (productId) ticket.productId = productId;
      if (orderId) ticket.orderId = orderId;
      if (storeName && (ticket.ticketType === 1 || ticket.ticketType === 2)) ticket.related = storeName;
      if (trackId && (ticket.ticketType === 4)) ticket.related = trackId;

      const savedTicket = await AppDataSource.getRepository(Ticket).save(ticket);
      
      // 创建系统评论，记录工单创建
      const comment = new TicketComment();
      comment.ticketId = savedTicket.id;
      comment.userId = userId;
      comment.content = '工单已创建，等待处理';
      await AppDataSource.getRepository(TicketComment).save(comment);

      return successResponse(res, savedTicket, '工单创建成功');
    } catch (error) {
      logger.error('创建工单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取工单列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, status, ticketType, priority, keyword } = req.query;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      
      const queryBuilder = AppDataSource.getRepository(Ticket)
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.creator', 'creator')
        .leftJoinAndSelect('ticket.assignee', 'assignee')
        .leftJoinAndSelect('ticket.order', 'order')
        .where('ticket.isDeleted = :isDeleted', { isDeleted: 0 });
      
      // 非管理员只能看到自己创建的或分配给自己的工单
      if (!userRoles.includes('ADMIN')) {
        queryBuilder.andWhere('(ticket.creatorId = :userId OR assignee.userId = :userId)', { userId });
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

  // 获取工单详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      
      const ticket = await AppDataSource.getRepository(Ticket)
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.creator', 'creator')
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
      
      // 检查权限：只有管理员、客服或工单创建者可以查看工单详情
      if (!userRoles.includes('ADMIN') && !userRoles.includes('SUPPORT') && ticket.creatorId !== userId) {
        return errorResponse(res, 403, '无权查看此工单', null);
      }
      
      // 过滤内部评论
      if (!userRoles.includes('ADMIN') && !userRoles.includes('SUPPORT')) {
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
      const { assigneeId } = req.body;
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
      const assignee = await AppDataSource.getRepository(User).findOne({
        where: { id: assigneeId }
      });
      
      if (!assignee) {
        return errorResponse(res, 400, '指定的处理人不存在', null);
      }
      
      // 更新工单状态和处理人
      ticket.assigneeId = assigneeId;
      if (ticket.status === 1) { // 如果是待处理状态，更新为处理中
        ticket.status = 2;
      }
      
      await ticketRepository.save(ticket);
      
      // 添加评论记录
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = `工单已分配给 ${assignee.name || assignee.username}`;
      await AppDataSource.getRepository(TicketComment).save(comment);
      
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
      
      // 更新工单状态为已取消
      ticket.status = 5;
      await ticketRepository.save(ticket);
      
      // 添加取消评论
      const comment = new TicketComment();
      comment.ticketId = Number(id);
      comment.userId = userId;
      comment.content = reason || '用户已取消工单';
      await AppDataSource.getRepository(TicketComment).save(comment);
      
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
      const userRoles = (req as any).userRoles || [];
      
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
}