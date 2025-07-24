import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CertificateTemplate } from '../models/entities/CertificateTemplate.entity';
import { successResponse, errorResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { Like, In } from 'typeorm';
import { Certificate } from '../models/entities/Certificate.entity';
import { User } from '../models/entities/User.entity';

export class CertificateController {
  // 获取证书模板列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const {
        page = 1,
        pageSize = 10,
        keyword = '',
        cer_type = ''
      } = req.query;

      const templateRepository = AppDataSource.getRepository(CertificateTemplate);
      const queryBuilder = templateRepository.createQueryBuilder('template')
        .where('template.is_deleted = :isDeleted', { isDeleted: false });

      // 关键词搜索
      if (keyword) {
        queryBuilder.andWhere(
          '(template.name LIKE :keyword OR template.description LIKE :keyword OR template.cer_title LIKE :keyword)',
          { keyword: `%${keyword}%` }
        );
      }

      // 证书类型筛选
      if (cer_type) {
        queryBuilder.andWhere('template.cer_type = :cerType', { cerType: Number(cer_type) });
      }

      // 排序
      queryBuilder.orderBy('template.created_at', 'DESC');

      // 分页
      const skip = (Number(page) - 1) * Number(pageSize);
      queryBuilder.skip(skip).take(Number(pageSize));

      const [templates, total] = await queryBuilder.getManyAndCount();

      // 格式化返回数据
      const formattedTemplates = templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        background_image: template.background_image,
        cer_type: template.cer_type,
        cer_fields: template.cer_fields,
        cer_title: template.cer_title,
        cer_content: template.cer_content,
        cer_right_signature_company: template.cer_right_signature_company,
        cer_right_signature_datetime: template.cer_right_signature_datetime,
        cer_right_signature_seal: template.cer_right_signature_seal,
        cer_left_signature_company: template.cer_left_signature_company,
        cer_left_signature_datetime: template.cer_left_signature_datetime,
        cer_left_signature_seal: template.cer_left_signature_seal,
        created_at: template.created_at,
        updated_at: template.updated_at
      }));

      return successResponse(res, {
        templates: formattedTemplates,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取证书模板列表成功');
    } catch (error) {
      logger.error('获取证书模板列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取证书模板详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const templateRepository = AppDataSource.getRepository(CertificateTemplate);
      
      const template = await templateRepository.findOne({
        where: { id: Number(id), is_deleted: false }
      });
      
      if (!template) {
        return errorResponse(res, 404, '证书模板不存在', null);
      }
      
      // 格式化返回数据
      const formattedTemplate = {
        id: template.id,
        name: template.name,
        description: template.description,
        background_image: template.background_image,
        cer_type: template.cer_type,
        cer_fields: template.cer_fields,
        cer_title: template.cer_title,
        cer_content: template.cer_content,
        cer_right_signature_company: template.cer_right_signature_company,
        cer_right_signature_datetime: template.cer_right_signature_datetime,
        cer_right_signature_seal: template.cer_right_signature_seal,
        cer_left_signature_company: template.cer_left_signature_company,
        cer_left_signature_datetime: template.cer_left_signature_datetime,
        cer_left_signature_seal: template.cer_left_signature_seal,
        created_at: template.created_at,
        updated_at: template.updated_at
      };
      
      return successResponse(res, formattedTemplate, '获取证书模板详情成功');
    } catch (error) {
      logger.error('获取证书模板详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建证书模板
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const {
        name,
        description,
        background_image,
        cer_type,
        cer_fields,
        cer_title,
        cer_content,
        cer_right_signature_company,
        cer_right_signature_datetime,
        cer_right_signature_seal,
        cer_left_signature_company,
        cer_left_signature_datetime,
        cer_left_signature_seal
      } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '模板名称不能为空', null);
      }
      
      if (!cer_type) {
        return errorResponse(res, 400, '证书类型不能为空', null);
      }
      
      const templateRepository = AppDataSource.getRepository(CertificateTemplate);
      
      // 检查模板名称是否重复
      const existingTemplate = await templateRepository.findOne({
        where: { name, is_deleted: false }
      });
      
      if (existingTemplate) {
        return errorResponse(res, 400, '模板名称已存在', null);
      }
      
      // 创建证书模板
      const template = new CertificateTemplate();
      template.name = name;
      template.description = description || null;
      template.background_image = background_image || null;
      template.cer_type = Number(cer_type);
      template.cer_fields = cer_fields || null;
      template.cer_title = cer_title || null;
      template.cer_content = cer_content || null;
      template.cer_right_signature_company = cer_right_signature_company || null;
      template.cer_right_signature_datetime = cer_right_signature_datetime || null;
      template.cer_right_signature_seal = cer_right_signature_seal || null;
      template.cer_left_signature_company = cer_left_signature_company || null;
      template.cer_left_signature_datetime = cer_left_signature_datetime || null;
      template.cer_left_signature_seal = cer_left_signature_seal || null;
      template.is_deleted = false;
      
      const savedTemplate = await templateRepository.save(template);
      
      return successResponse(res, { id: savedTemplate.id }, '创建证书模板成功');
    } catch (error) {
      logger.error('创建证书模板失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新证书模板
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        background_image,
        cer_type,
        cer_fields,
        cer_title,
        cer_content,
        cer_right_signature_company,
        cer_right_signature_datetime,
        cer_right_signature_seal,
        cer_left_signature_company,
        cer_left_signature_datetime,
        cer_left_signature_seal
      } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '模板名称不能为空', null);
      }
      
      const templateRepository = AppDataSource.getRepository(CertificateTemplate);
      
      // 检查证书模板是否存在
      const template = await templateRepository.findOne({
        where: { id: Number(id), is_deleted: false }
      });
      
      if (!template) {
        return errorResponse(res, 404, '证书模板不存在', null);
      }
      
      // 检查模板名称是否重复（排除自身）
      const existingTemplate = await templateRepository.findOne({
        where: { name, is_deleted: false }
      });
      
      if (existingTemplate && existingTemplate.id !== Number(id)) {
        return errorResponse(res, 400, '模板名称已存在', null);
      }
      
      // 更新证书模板信息
      template.name = name;
      template.description = description || null;
      template.background_image = background_image || null;
      template.cer_type = Number(cer_type);
      template.cer_fields = cer_fields || null;
      template.cer_title = cer_title || null;
      template.cer_content = cer_content || null;
      template.cer_right_signature_company = cer_right_signature_company || null;
      template.cer_right_signature_datetime = cer_right_signature_datetime || null;
      template.cer_right_signature_seal = cer_right_signature_seal || null;
      template.cer_left_signature_company = cer_left_signature_company || null;
      template.cer_left_signature_datetime = cer_left_signature_datetime || null;
      template.cer_left_signature_seal = cer_left_signature_seal || null;
      
      await templateRepository.save(template);
      
      return successResponse(res, { id: template.id }, '更新证书模板成功');
    } catch (error) {
      logger.error('更新证书模板失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除证书模板
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const templateRepository = AppDataSource.getRepository(CertificateTemplate);
      
      // 检查证书模板是否存在
      const template = await templateRepository.findOne({
        where: { id: Number(id), is_deleted: false }
      });
      
      if (!template) {
        return errorResponse(res, 404, '证书模板不存在', null);
      }
      
      // 软删除证书模板
      template.is_deleted = true;
      await templateRepository.save(template);
      
      return successResponse(res, null, '删除证书模板成功');
    } catch (error) {
      logger.error('删除证书模板失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 批量删除证书模板
  async batchDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要删除的证书模板', null);
      }
      
      const templateRepository = AppDataSource.getRepository(CertificateTemplate);
      
      // 查找所有要删除的证书模板
      const templates = await templateRepository.find({
        where: ids.map(id => ({ id: id, is_deleted: false }))
      });
      
      if (templates.length === 0) {
        return errorResponse(res, 404, '未找到要删除的证书模板', null);
      }
      
      // 软删除所有证书模板
      for (const template of templates) {
        template.is_deleted = true;
      }
      
      await templateRepository.save(templates);
      
      return successResponse(res, null, `成功删除${templates.length}个证书模板`);
    } catch (error) {
      logger.error('批量删除证书模板失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取证书类型选项
  async getCertificateTypes(req: Request, res: Response): Promise<Response> {
    try {
      const certificateTypes = [
        { value: 1, label: '培训证书' },
        { value: 2, label: '结业证书' },
        { value: 3, label: '荣誉证书' },
        { value: 4, label: '技能证书' },
        { value: 5, label: '其他证书' }
      ];
      
      return successResponse(res, certificateTypes, '获取证书类型成功');
    } catch (error) {
      logger.error('获取证书类型失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 颁发证书
  async issue(req: Request, res: Response): Promise<Response> {
    try {
      const { templateId, userIds, reason, issueDate } = req.body;
      
      if (!templateId || !userIds || !reason) {
        return errorResponse(res, 400, '模板ID、用户ID和颁发原因不能为空', null);
      }
      
      const templateRepository = AppDataSource.getRepository(CertificateTemplate);
      const userRepository = AppDataSource.getRepository(User);
      const certificateRepository = AppDataSource.getRepository(Certificate);
      
      // 检查证书模板是否存在
      const template = await templateRepository.findOne({
        where: { id: Number(templateId), is_deleted: false }
      });
      
      if (!template) {
        return errorResponse(res, 404, '证书模板不存在', null);
      }
      
      // 检查用户是否存在
      const users = await userRepository.findBy({ _id: In(userIds) });
      
      if (users.length === 0) {
        return errorResponse(res, 404, '用户不存在', null);
      }
      
      // 颁发证书
      const certificates = [];
      for (const user of users) {
        const certificate = new Certificate();
        certificate.template_id = template.id;
        certificate.user_id = user._id;
        certificate.certificate_number = this.generateCertificateNumber();
        certificate.student_name = user.realname || user.name;
        certificate.remark = reason;
        certificate.issue_date = issueDate || new Date();
        certificates.push(certificate);
      }
      
      await certificateRepository.save(certificates);
      
      return successResponse(res, { effect: certificates.length }, '颁发证书成功');
    } catch (error) {
      logger.error('颁发证书失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 生成证书编号
  private generateCertificateNumber(): string {
    const prefix = 'CER';
    const randomNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const timestamp = Date.now();
    return `${prefix}${randomNumber}${timestamp}`;
  }
}