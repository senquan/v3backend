import * as dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { Permission } from '../models/permission.entity';

// 加载环境变量
dotenv.config();

// Finance路由配置数据
const financeRoutes = [
  {
    name: '财务管理',
    title: 'Finance Management',
    code: 'finance',
    type: 1, // 目录类型
    path: '/finance',
    redirect: '/finance/dashboard',
    icon: 'PieChart',
    sort: 100,
    hidden: 0,
    status: 1
  },
  {
    name: '财务首页',
    title: 'Finance Dashboard',
    code: 'finance:dashboard',
    type: 2, // 菜单类型
    path: '/finance/dashboard',
    component: '@/pages/finance/dashboard.vue',
    icon: 'PieChart',
    sort: 101,
    hidden: 0,
    status: 1
  },
  {
    name: '单位管理',
    title: '单位管理',
    code: 'finance:companies',
    type: 2,
    path: '/finance/companies',
    component: '@/pages/finance/companies.vue',
    icon: 'OfficeBuilding',
    sort: 102,
    hidden: 0,
    status: 1
  },
  {
    name: '存款管理',
    title: '存款管理',
    code: 'finance:deposits',
    type: 2,
    path: '/finance/deposits',
    component: '@/pages/finance/deposits.vue',
    icon: 'Bankcard',
    sort: 103,
    hidden: 0,
    status: 1
  },
  {
    name: '费用管理',
    title: '费用管理',
    code: 'finance:expenses',
    type: 2,
    path: '/finance/expenses',
    component: '@/pages/finance/expenses.vue',
    icon: 'Coin',
    sort: 104,
    hidden: 0,
    status: 1
  },
  {
    name: '利润上缴',
    title: '利润上缴',
    code: 'finance:payments',
    type: 2,
    path: '/finance/payments',
    component: '@/pages/finance/payments.vue',
    icon: 'Money',
    sort: 105,
    hidden: 0,
    status: 1
  }
];

async function insertFinancePermissions() {
  try {
    // 初始化数据库连接
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    const permissionRepository = AppDataSource.getRepository(Permission);

    // 检查是否已存在财务权限
    const existingPermission = await permissionRepository.findOne({
      where: { code: 'finance' }
    });

    if (existingPermission) {
      console.log('财务权限已存在，跳过插入');
      return;
    }

    // 插入父级菜单（财务管理目录）
    const parentPermission = permissionRepository.create({
      name: financeRoutes[0].name,
      title: financeRoutes[0].title,
      code: financeRoutes[0].code,
      type: financeRoutes[0].type,
      path: financeRoutes[0].path,
      redirect: financeRoutes[0].redirect,
      icon: financeRoutes[0].icon,
      sort: financeRoutes[0].sort,
      hidden: financeRoutes[0].hidden,
      status: financeRoutes[0].status
    });

    const savedParent = await permissionRepository.save(parentPermission);
    console.log(`插入父级菜单成功，ID: ${savedParent.id}`);

    // 插入子菜单
    const childRoutes = financeRoutes.slice(1);
    for (const route of childRoutes) {
      const childPermission = permissionRepository.create({
        name: route.name,
        title: route.title,
        code: route.code,
        type: route.type,
        parentId: savedParent.id,
        path: route.path,
        component: route.component,
        icon: route.icon,
        sort: route.sort,
        hidden: route.hidden,
        status: route.status
      });

      await permissionRepository.save(childPermission);
      console.log(`插入子菜单成功: ${route.name}`);
    }

    console.log('所有财务权限插入完成');

    // 查询插入的结果
    const result = await permissionRepository
      .createQueryBuilder('permission')
      .where('permission.code LIKE :code', { code: 'finance%' })
      .orderBy('permission.sort')
      .getMany();

    console.log('\n插入的权限列表:');
    result.forEach(permission => {
      console.log(`${permission.id} | ${permission.name} | ${permission.code} | ${permission.path}`);
    });

  } catch (error) {
    console.error('插入权限失败:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

// 执行插入
insertFinancePermissions();