import { Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { Branch } from "../models/entities/Branch.entity";
import { Project } from "../models/entities/Project.entity";
import { logger } from "../utils/logger";
import { errorResponse, successResponse } from "../utils/response";

export class BranchController {
  // 获取部门列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, format = "" } = req.query;
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(Branch)
        .createQueryBuilder("branch")
        .where("branch.enabled = :enabled", { enabled: true });

      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere("branch.name LIKE :keyword", { keyword: `%${keyword}%` });
      }

      if (format === "opt") {
        // 查询所有部门
        const branches = await queryBuilder.getMany();
              
        const projects = await AppDataSource.getRepository(Project)
          .createQueryBuilder('project')
          .getMany();
          
        const options = branches.map(branch => ({
          id: branch._id,
          parentId: 0,
          name: branch.name,
          children: projects.filter(project => project.branch === branch._id).map(project => ({
            id: project._id,
            parentId: branch._id,
            name: project.name
          }))
        }));
        return successResponse(res, {
          branches: options
        }, "获取部门列表成功");
      } else {
        // 计算分页
        const pageNum = Number(page);
        const pageSizeNum = Number(pageSize);
        const skip = (pageNum - 1) * pageSizeNum;
        
        // 获取总数和分页数据
        const [branches, total] = await queryBuilder
          .orderBy("branch._id", "ASC")
          .skip(skip)
          .take(pageSizeNum)
          .getManyAndCount();
        
        return successResponse(res, {
          branches,
          total,
          page: pageNum,
          pageSize: pageSizeNum
        }, "获取部门列表成功");
      }
    } catch (error) {
      logger.error("获取部门列表失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }
}