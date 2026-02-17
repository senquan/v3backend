import * as dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { Permission } from '../models/permission.entity';
import { RolePermission } from '../models/role-permission.entity';

// 加载环境变量
dotenv.config();

// 菜单规划数据
const menuStructure = [
  // 一级菜单
  {
    name: '系统首页',
    title: 'Dashboard',
    code: 'dashboard',
    type: 1,
    path: '/dashboard',
    icon: 'HomeFilled',
    sort: 1,
    hidden: 0,
    status: 1
  },
  {
    name: '基础数据管理',
    title: 'Basic Data Management',
    code: 'basic-data',
    type: 1,
    path: '/basic-data',
    icon: 'Setting',
    sort: 2,
    hidden: 0,
    status: 1
  },
  {
    name: '财务管理',
    title: 'Financial Management',
    code: 'finance',
    type: 1,
    path: '/finance',
    icon: 'Money',
    sort: 3,
    hidden: 0,
    status: 1
  },
  {
    name: '报表中心',
    title: 'Report Center',
    code: 'report',
    type: 1,
    path: '/report',
    icon: 'Document',
    sort: 4,
    hidden: 0,
    status: 1
  },
  {
    name: '系统管理',
    title: 'System Management',
    code: 'system',
    type: 1,
    path: '/system',
    icon: 'Tools',
    sort: 5,
    hidden: 0,
    status: 1
  }
];

// 子菜单数据
const subMenuStructure = [
  // 基础数据管理子菜单
  {
    parentCode: 'basic-data',
    children: [
      {
        name: '单位信息管理',
        title: 'Company Info Management',
        code: 'basic-data:company',
        type: 2,
        path: '/basic-data/company',
        icon: 'OfficeBuilding',
        sort: 1,
        hidden: 0,
        status: 1
      },
      {
        name: '用户权限管理',
        title: 'User Permission Management',
        code: 'basic-data:user',
        type: 2,
        path: '/basic-data/user',
        icon: 'User',
        sort: 2,
        hidden: 0,
        status: 1
      },
      {
        name: '系统参数配置',
        title: 'System Configuration',
        code: 'basic-data:config',
        type: 2,
        path: '/basic-data/config',
        icon: 'Setting',
        sort: 3,
        hidden: 0,
        status: 1
      }
    ]
  },
  // 财务管理子菜单
  {
    parentCode: 'finance',
    children: [
      {
        name: '内部存款代垫费用清算',
        title: 'Internal Deposit Advance Expense Clearing',
        code: 'finance:internal-deposit',
        type: 2,
        path: '/finance/internal-deposit',
        icon: 'Bankcard',
        sort: 1,
        hidden: 0,
        status: 1
      },
      {
        name: '内部存贷款管理',
        title: 'Internal Loan Management',
        code: 'finance:loan-management',
        type: 2,
        path: '/finance/loan-management',
        component: 'pages/finance/loan-management.vue',
        icon: 'CreditCard',
        sort: 2,
        hidden: 0,
        status: 1
      },
      {
        name: '到款清算管理',
        title: 'Payment Clearing Management',
        code: 'finance:payment-clearing',
        type: 2,
        path: '/finance/payment-clearing',
        icon: 'Collection',
        sort: 3,
        hidden: 0,
        status: 1
      },
      {
        name: '资金上划下拨',
        title: 'Fund Transfer Management',
        code: 'finance:fund-transfer',
        type: 2,
        path: '/finance/fund-transfer',
        icon: 'Top',
        sort: 4,
        hidden: 0,
        status: 1
      },
      {
        name: '利润上缴管理',
        title: 'Profit Payment Management',
        code: 'finance:profit-payment',
        type: 2,
        path: '/finance/profit-payment',
        icon: 'TrendCharts',
        sort: 5,
        hidden: 0,
        status: 1
      },
      {
        name: '代垫费用管理',
        title: 'Advance Expense Management',
        code: 'finance:advance-expense',
        type: 2,
        path: '/finance/advance-expense',
        icon: 'List',
        sort: 6,
        hidden: 0,
        status: 1
      },
      {
        name: '定期存款管理',
        title: 'Fixed Deposit Management',
        code: 'finance:fixed-deposit',
        type: 2,
        path: '/finance/fixed-deposit',
        icon: 'Timer',
        sort: 7,
        hidden: 0,
        status: 1
      }
    ]
  },
  // 报表中心子菜单
  {
    parentCode: 'report',
    children: [
      {
        name: '财务汇总报表',
        title: 'Financial Summary Report',
        code: 'report:summary',
        type: 2,
        path: '/report/summary',
        icon: 'PieChart',
        sort: 1,
        hidden: 0,
        status: 1
      },
      {
        name: '明细查询报表',
        title: 'Detail Query Report',
        code: 'report:detail',
        type: 2,
        path: '/report/detail',
        icon: 'DataAnalysis',
        sort: 2,
        hidden: 0,
        status: 1
      },
      {
        name: '穿透查询报表',
        title: 'Drill-down Query Report',
        code: 'report:drill-down',
        type: 2,
        path: '/report/drill-down',
        icon: 'Search',
        sort: 3,
        hidden: 0,
        status: 1
      }
    ]
  },
  // 系统管理子菜单
  {
    parentCode: 'system',
    children: [
      {
        name: '角色权限管理',
        title: 'Role Permission Management',
        code: 'system:role',
        type: 2,
        path: '/system/role',
        icon: 'Avatar',
        sort: 1,
        hidden: 0,
        status: 1
      },
      {
        name: '操作日志管理',
        title: 'Operation Log Management',
        code: 'system:log',
        type: 2,
        path: '/system/log',
        icon: 'Tickets',
        sort: 2,
        hidden: 0,
        status: 1
      },
      {
        name: '数据备份恢复',
        title: 'Data Backup & Restore',
        code: 'system:backup',
        type: 2,
        path: '/system/backup',
        component: 'pages/system/backup.vue',
        icon: 'Download',
        sort: 3,
        hidden: 0,
        status: 1
      }
    ]
  }
];

async function setupMenuPermissions() {
  try {
    // 初始化数据库连接
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    const permissionRepository = AppDataSource.getRepository(Permission);
    const rolePermissionRepository = AppDataSource.getRepository(RolePermission);

    // 清空现有菜单权限（谨慎操作）
    console.log('开始清理现有菜单权限...');
    const existingPermissions = await permissionRepository
      .createQueryBuilder('permission')
      .where('permission.code LIKE :pattern', { pattern: 'dashboard%' })
      .orWhere('permission.code LIKE :pattern2', { pattern2: 'basic-data%' })
      .orWhere('permission.code LIKE :pattern3', { pattern3: 'finance%' })
      .orWhere('permission.code LIKE :pattern4', { pattern4: 'report%' })
      .orWhere('permission.code LIKE :pattern5', { pattern5: 'system%' })
      .getMany();

    if (existingPermissions.length > 0) {
      console.log(`发现 ${existingPermissions.length} 个现有权限，正在清理...`);
      // 这里可以选择删除现有权限，但为了安全起见，我们跳过已存在的权限
    }

    // 插入一级菜单
    console.log('开始插入一级菜单...');
    const parentPermissions: Record<string, Permission> = {};

    for (const menu of menuStructure) {
      // 检查是否已存在
      const existing = await permissionRepository.findOne({
        where: { code: menu.code }
      });

      if (existing) {
        console.log(`菜单已存在: ${menu.name}`);
        parentPermissions[menu.code] = existing;
        continue;
      }

      const permission = permissionRepository.create(menu);
      const savedPermission = await permissionRepository.save(permission);
      parentPermissions[menu.code] = savedPermission;
      console.log(`插入一级菜单成功: ${menu.name} (ID: ${savedPermission.id})`);
    }

    // 插入子菜单
    console.log('开始插入子菜单...');
    for (const submenuGroup of subMenuStructure) {
      const parentPermission = parentPermissions[submenuGroup.parentCode];
      if (!parentPermission) {
        console.warn(`未找到父级菜单: ${submenuGroup.parentCode}`);
        continue;
      }

      for (const child of submenuGroup.children) {
        // 检查是否已存在
        const existing = await permissionRepository.findOne({
          where: { code: child.code }
        });

        if (existing) {
          console.log(`子菜单已存在: ${child.name}`);
          continue;
        }

        const childPermission = permissionRepository.create({
          ...child,
          parentId: parentPermission.id
        });

        await permissionRepository.save(childPermission);
        console.log(`插入子菜单成功: ${child.name}`);
      }
    }

    // 为管理员分配所有菜单权限
    console.log('开始为管理员分配菜单权限...');
    const allPermissions = await permissionRepository
      .createQueryBuilder('permission')
      .where('permission.status = :status', { status: 1 })
      .getMany();

    const roleId = 1; // 管理员角色ID

    for (const permission of allPermissions) {
      // 检查是否已分配
      const existingAssignment = await rolePermissionRepository.findOne({
        where: {
          roleId: roleId,
          permissionId: permission.id
        }
      });

      if (!existingAssignment) {
        const rolePermission = rolePermissionRepository.create({
          roleId: roleId,
          permissionId: permission.id
        });
        await rolePermissionRepository.save(rolePermission);
      }
    }

    console.log('菜单权限分配完成');

    // 显示菜单结构
    console.log('\n=== 系统菜单结构 ===');
    const allMenus = await permissionRepository
      .createQueryBuilder('permission')
      .leftJoinAndSelect('permission.children', 'children')
      .where('permission.parentId IS NULL')
      .andWhere('permission.status = :status', { status: 1 })
      .orderBy('permission.sort')
      .getMany();

    allMenus.forEach(menu => {
      console.log(`${menu.sort}. ${menu.name} (${menu.code})`);
      menu.children
        .filter(child => child.status === 1)
        .sort((a, b) => a.sort - b.sort)
        .forEach(child => {
          console.log(`   ${child.sort}. ${child.name} (${child.code})`);
        });
    });

    console.log('\n菜单规划完成！');

  } catch (error) {
    console.error('菜单规划失败:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

// 执行菜单规划
setupMenuPermissions();