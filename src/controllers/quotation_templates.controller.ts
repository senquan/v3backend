import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { QuotationTemplate } from '../models/quotation-template.model'
import { PlatformQuotationTemplateAssociation } from '../models/platform-quotation-template-association.model'
import { errorResponse, successResponse } from '../utils/response'
import { logger } from '../utils/logger'

export class QuotationTemplatesController {
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, templateName, isEnabled } = req.query
      const queryBuilder = AppDataSource.getRepository(QuotationTemplate)
        .createQueryBuilder('template')
        .where('template.isDeleted = :isDeleted', { isDeleted: 0 })

      if (templateName) {
        queryBuilder.andWhere('template.templateName LIKE :templateName', { templateName: `%${templateName}%` })
      }

      if (isEnabled !== undefined) {
        queryBuilder.andWhere('template.isEnabled = :isEnabled', { isEnabled: Number(isEnabled) })
      }

      const pageNum = Number(page)
      const pageSizeNum = Number(pageSize)
      const skip = (pageNum - 1) * pageSizeNum

      const [templates, total] = await queryBuilder
        .orderBy('template.id', 'DESC')
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount()

      return successResponse(res, {
        templates,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取报价模板列表成功')
    } catch (error) {
      logger.error('获取报价模板列表失败:', error)
      return errorResponse(res, 500, '服务器内部错误', null)
    }
  }

  // 根据平台和类型获取模板
  async getTemplateByPlatform(req: Request, res: Response): Promise<Response> {
    try {
      const { platformId, type } = req.query

      if (!platformId) {
        return errorResponse(res, 400, 'platformId 不能为空', null)
      }

      // 一次查询该平台所有模板关联
      const associations = await AppDataSource.getRepository(PlatformQuotationTemplateAssociation)
        .createQueryBuilder('assoc')
        .leftJoinAndSelect('assoc.template', 'template')
        .where('assoc.platformId = :platformId', { platformId: Number(platformId) })
        .andWhere('assoc.isDeleted = 0')
        .andWhere('template.isDeleted = 0')
        .getMany()

      // 优先匹配当前 type
      const requestedType = Number(type) || 1
      let association = associations.find(a => a.type === requestedType)

      // 没有则回退 type=1
      if (!association && requestedType !== 1) {
        association = associations.find(a => a.type === 1)
      }

      if (association) {
        return successResponse(res, association.template, '获取模板成功')
      }

      // 再没有则返回全局默认模板
      const defaultTemplate = await AppDataSource.getRepository(QuotationTemplate)
        .createQueryBuilder('template')
        .where('template.isEnabled = 1')
        .andWhere('template.isDeleted = 0')
        .orderBy('template.id', 'ASC')
        .getOne()

      if (defaultTemplate) {
        return successResponse(res, defaultTemplate, '获取默认模板成功')
      }

      return successResponse(res, null, '未找到模板')
    } catch (error) {
      logger.error('根据平台和类型获取模板失败:', error)
      return errorResponse(res, 500, '服务器内部错误', null)
    }
  }

  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const template = await AppDataSource.getRepository(QuotationTemplate).findOne({
        where: { id: Number(id), isDeleted: 0 }
      })

      if (!template) {
        return errorResponse(res, 404, '报价模板不存在', null)
      }

      return successResponse(res, template, '获取报价模板详情成功')
    } catch (error) {
      logger.error('获取报价模板详情失败:', error)
      return errorResponse(res, 500, '服务器内部错误', null)
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { templateName, templateParams, isEnabled } = req.body

      if (!templateName) {
        return errorResponse(res, 400, 'templateName 为必填项', null)
      }

      const template = new QuotationTemplate()
      template.templateName = String(templateName)
      template.templateParams = templateParams ? JSON.stringify(templateParams) : null
      template.isEnabled = isEnabled !== undefined ? Number(isEnabled) : 1

      const savedTemplate = await AppDataSource.getRepository(QuotationTemplate).save(template)

      return successResponse(res, savedTemplate, '创建报价模板成功')
    } catch (error) {
      logger.error('创建报价模板失败:', error)
      return errorResponse(res, 500, '服务器内部错误', null)
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const { templateName, templateParams, isEnabled } = req.body

      const templateRepo = AppDataSource.getRepository(QuotationTemplate)
      const template = await templateRepo.findOne({ where: { id: Number(id), isDeleted: 0 } })
      if (!template) {
        return errorResponse(res, 404, '报价模板不存在', null)
      }

      if (templateName !== undefined) {
        template.templateName = String(templateName)
      }
      if (templateParams !== undefined) {
        template.templateParams = templateParams ? JSON.stringify(templateParams) : null
      }
      if (isEnabled !== undefined) {
        template.isEnabled = Number(isEnabled)
      }

      const updatedTemplate = await templateRepo.save(template)
      return successResponse(res, updatedTemplate, '更新报价模板成功')
    } catch (error) {
      logger.error('更新报价模板失败:', error)
      return errorResponse(res, 500, '服务器内部错误', null)
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const templateRepo = AppDataSource.getRepository(QuotationTemplate)
      const template = await templateRepo.findOne({ where: { id: Number(id), isDeleted: 0 } })
      if (!template) {
        return errorResponse(res, 404, '报价模板不存在', null)
      }

      template.isDeleted = 1
      const deletedTemplate = await templateRepo.save(template)
      return successResponse(res, deletedTemplate, '删除报价模板成功')
    } catch (error) {
      logger.error('删除报价模板失败:', error)
      return errorResponse(res, 500, '服务器内部错误', null)
    }
  }
}
