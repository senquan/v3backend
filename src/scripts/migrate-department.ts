/**
 * 部门数据迁移脚本
 * 将 staff.department (smallint) 迁移到 departments 独立表 + staff.department_id (int FK)
 * 
 * 使用方法：
 *   npx ts-node src/scripts/migrate-department.ts
 */
import { AppDataSource } from '../config/database';
import { Department } from '../models/department.model';
import { Staff } from '../models/staff.model';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

// 旧 department 值与名称的映射（根据实际情况修改）
const DEPARTMENT_MAP: Record<number, string> = {
  1: '销售部',
  2: '客服部',
  3: '仓储部',
  4: '财务部',
  5: '运营部',
  6: '技术部',
  7: '行政部',
  8: '采购部',
  9: '市场部',
  10: '总经办'
};

async function migrate() {
  try {
    logger.info('========== 部门数据迁移开始 ==========');

    await AppDataSource.initialize();
    logger.info('数据库连接成功');

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    const deptRepo = AppDataSource.getRepository(Department);
    const staffRepo = AppDataSource.getRepository(Staff);

    // 1. 检查 staff 表是否还有旧的 department 列
    const columns = await queryRunner.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'department'`
    );

    if (columns.length === 0) {
      logger.info('staff.department 列已不存在，跳过迁移');
      await queryRunner.release();
      await AppDataSource.destroy();
      return;
    }

    // 2. 查询旧的 department 列中有哪些不同的值
    const distinctDepts: any[] = await queryRunner.query(
      `SELECT DISTINCT department FROM staff WHERE department IS NOT NULL AND department != 0`
    );
    logger.info(`发现 ${distinctDepts.length} 个不同的部门值: ${distinctDepts.map(d => d.department).join(', ')}`);

    // 3. 为每个旧值创建部门记录（如果不存在）
    const mapping: Record<number, number> = {}; // oldDeptValue -> newDeptId

    for (const row of distinctDepts) {
      const oldVal = Number(row.department);
      const deptName = DEPARTMENT_MAP[oldVal] || `部门${oldVal}`;

      // 检查是否已有同名部门
      let dept = await deptRepo.findOne({ where: { name: deptName, isDeleted: 0 } });
      if (!dept) {
        dept = new Department();
        dept.name = deptName;
        dept.parentId = 0;
        dept.sort = oldVal;
        dept.isActive = 1;
        dept = await deptRepo.save(dept);
        logger.info(`创建部门: ${deptName} (ID=${dept.id})`);
      } else {
        logger.info(`部门已存在: ${deptName} (ID=${dept.id})`);
      }
      mapping[oldVal] = dept.id;
    }

    // 4. 将 staff.department 映射到 staff.department_id
    let updatedCount = 0;
    for (const [oldVal, newId] of Object.entries(mapping)) {
      const result = await queryRunner.query(
        `UPDATE staff SET department_id = ? WHERE department = ? AND department_id IS NULL`,
        [newId, Number(oldVal)]
      );
      const affected = result.affectedRows ?? 0;
      if (affected > 0) {
        logger.info(`已迁移: department=${oldVal} → department_id=${newId}，共 ${affected} 人`);
        updatedCount += affected;
      }
    }

    logger.info(`共迁移 ${updatedCount} 名员工的部门关系`);

    // 5. 可选：删除旧的 department 列（取消注释以执行）
    // await queryRunner.query(`ALTER TABLE staff DROP COLUMN department`);
    // logger.info('已删除 staff.department 旧列');
    logger.info('提示: 如需删除旧的 staff.department 列，请手动执行: ALTER TABLE staff DROP COLUMN department;');

    await queryRunner.release();
    await AppDataSource.destroy();
    logger.info('========== 部门数据迁移完成 ==========');
  } catch (error) {
    logger.error('迁移失败:', error);
    process.exit(1);
  }
}

migrate();

