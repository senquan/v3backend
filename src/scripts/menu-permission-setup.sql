-- 财务管理系统菜单权限规划SQL脚本

-- 清空现有权限数据（谨慎使用）
-- DELETE FROM permissions WHERE code LIKE 'dashboard%' OR code LIKE 'basic-data%' OR code LIKE 'finance%' OR code LIKE 'report%' OR code LIKE 'system%';

-- 插入一级菜单
INSERT INTO permissions (name, title, code, type, path, icon, sort, hidden, status, created_at, updated_at) VALUES
('系统首页', 'Dashboard', 'dashboard', 1, '/dashboard', 'HomeFilled', 1, 0, 1, NOW(), NOW()),
('基础数据管理', 'Basic Data Management', 'basic-data', 1, '/basic-data', 'Setting', 2, 0, 1, NOW(), NOW()),
('财务管理', 'Financial Management', 'finance', 1, '/finance', 'Money', 3, 0, 1, NOW(), NOW()),
('报表中心', 'Report Center', 'report', 1, '/report', 'Document', 4, 0, 1, NOW(), NOW()),
('系统管理', 'System Management', 'system', 1, '/system', 'Tools', 5, 0, 1, NOW(), NOW());

-- 获取各一级菜单的ID
-- dashboard_id = SELECT id FROM permissions WHERE code = 'dashboard';
-- basic_data_id = SELECT id FROM permissions WHERE code = 'basic-data';
-- finance_id = SELECT id FROM permissions WHERE code = 'finance';
-- report_id = SELECT id FROM permissions WHERE code = 'report';
-- system_id = SELECT id FROM permissions WHERE code = 'system';

-- 插入基础数据管理子菜单
INSERT INTO permissions (name, title, code, type, parent_id, path, icon, sort, hidden, status, created_at, updated_at) VALUES
('单位信息管理', 'Company Info Management', 'basic-data:company', 2, 2, '/basic-data/company', 'OfficeBuilding', 1, 0, 1, NOW(), NOW()),
('用户权限管理', 'User Permission Management', 'basic-data:user', 2, 2, '/basic-data/user', 'User', 2, 0, 1, NOW(), NOW()),
('系统参数配置', 'System Configuration', 'basic-data:config', 2, 2, '/basic-data/config', 'Setting', 3, 0, 1, NOW(), NOW());

-- 插入财务管理子菜单
INSERT INTO permissions (name, title, code, type, parent_id, path, icon, sort, hidden, status, created_at, updated_at) VALUES
('内部存款代垫费用清算', 'Internal Deposit Advance Expense Clearing', 'finance:internal-deposit', 2, 3, '/finance/internal-deposit', 'Bankcard', 1, 0, 1, NOW(), NOW()),
('内部存贷款管理', 'Internal Loan Management', 'finance:loan-management', 2, 3, '/finance/loan-management', 'CreditCard', 2, 0, 1, NOW(), NOW()),
('到款清算管理', 'Payment Clearing Management', 'finance:payment-clearing', 2, 3, '/finance/payment-clearing', 'Collection', 3, 0, 1, NOW(), NOW()),
('资金上划下拨', 'Fund Transfer Management', 'finance:fund-transfer', 2, 3, '/finance/fund-transfer', 'Top', 4, 0, 1, NOW(), NOW()),
('利润上缴管理', 'Profit Payment Management', 'finance:profit-payment', 2, 3, '/finance/profit-payment', 'TrendCharts', 5, 0, 1, NOW(), NOW()),
('代垫费用管理', 'Advance Expense Management', 'finance:advance-expense', 2, 3, '/finance/advance-expense', 'List', 6, 0, 1, NOW(), NOW()),
('定期存款管理', 'Fixed Deposit Management', 'finance:fixed-deposit', 2, 3, '/finance/fixed-deposit', 'Timer', 7, 0, 1, NOW(), NOW());

-- 插入报表中心子菜单
INSERT INTO permissions (name, title, code, type, parent_id, path, icon, sort, hidden, status, created_at, updated_at) VALUES
('财务汇总报表', 'Financial Summary Report', 'report:summary', 2, 4, '/report/summary', 'PieChart', 1, 0, 1, NOW(), NOW()),
('明细查询报表', 'Detail Query Report', 'report:detail', 2, 4, '/report/detail', 'DataAnalysis', 2, 0, 1, NOW(), NOW()),
('穿透查询报表', 'Drill-down Query Report', 'report:drill-down', 2, 4, '/report/drill-down', 'Search', 3, 0, 1, NOW(), NOW());

-- 插入系统管理子菜单
INSERT INTO permissions (name, title, code, type, parent_id, path, icon, sort, hidden, status, created_at, updated_at) VALUES
('角色权限管理', 'Role Permission Management', 'system:role', 2, 5, '/system/role', 'Avatar', 1, 0, 1, NOW(), NOW()),
('操作日志管理', 'Operation Log Management', 'system:log', 2, 5, '/system/log', 'Tickets', 2, 0, 1, NOW(), NOW()),
('数据备份恢复', 'Data Backup & Restore', 'system:backup', 2, 5, '/system/backup', 'Download', 3, 0, 1, NOW(), NOW());

-- 为管理员角色分配所有菜单权限
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 1, id, NOW() FROM permissions WHERE status = 1;

-- 验证插入结果
SELECT p.id, p.name, p.code, p.type, p.path, p.icon, p.sort, 
       parent.name as parent_name, parent.code as parent_code
FROM permissions p
LEFT JOIN permissions parent ON p.parent_id = parent.id
ORDER BY p.sort, p.id;