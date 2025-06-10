import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Category } from '../models/category.model';
import { Coupon } from '../models/coupon.model';
import { CouponUser } from '../models/coupon-user.model';
import { Customer } from '../models/customer.model';
import { Dict } from '../models/dict.model';
import { InviteCode } from '../models/invite-code.model';
import { Order } from '../models/order.model';
import { OrderCalculationLog } from '../models/order-calculation-log.model';
import { OrderItem } from '../models/order-item.model';
import { OrderStatusLog } from '../models/order-status-log.model';
import { Permission } from '../models/permission.model';
import { PlatformTags } from '../models/platform-tags.model';
import { Product } from '../models/product.model';
import { ProductTag } from '../models/product-tag.model';
import { ProductModel } from '../models/product-model.model';
import { ProductSeries } from '../models/product-series.model';
import { ProductSeriesTag } from '../models/product-series-tag.model';
import { Promotion } from '../models/promotion.model';
import { PromotionPlatforms } from '../models/promotion-platforms.motel';
import { PromotionRule } from '../models/promotion-rule.model';
import { ReturnOrder } from '../models/return-order.model';
import { ReturnOrderItem } from '../models/return-order-item.model';
import { Role } from '../models/role.model';
import { RolePermission } from '../models/role-permission.model';
import { RolePlatforms } from '../models/role-platforms.model';
import { RoleTags } from '../models/role-tags.model';
import { Settings } from '../models/settings.model';
import { SpecGroup } from '../models/spec-group.model';
import { SpecItem } from '../models/spec-item.model';
import { Staff } from '../models/staff.model';
import { Tag } from '../models/tag.model';
import { Ticket } from '../models/ticket.model';
import { TicketAttachment } from '../models/ticket-attachment.model';
import { TicketComment } from '../models/ticket-comment.model';
import { User } from '../models/user.model';
import { UserRole } from '../models/user-roles.model';

// 加载环境变量
dotenv.config();

// 创建数据源
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'cardbug',
  synchronize: process.env.NODE_ENV !== 'production', // 开发环境自动同步数据库结构
  logging: process.env.NODE_ENV !== 'production',
  entities: [Category, Coupon, CouponUser, Customer, Dict, InviteCode, Order, OrderCalculationLog, OrderItem, OrderStatusLog, Permission, PlatformTags, Product, ProductModel, ProductSeries, ProductSeriesTag, ProductTag,
    Promotion, PromotionPlatforms, PromotionRule, Role, RolePermission, RolePlatforms, RoleTags, ReturnOrder, ReturnOrderItem, Settings, SpecGroup, SpecItem, Staff, Tag, Ticket, TicketAttachment, TicketComment, User, UserRole],
  migrations: [__dirname + '/../migrations/**/*.ts'],
  subscribers: [__dirname + '/../subscribers/**/*.ts'],
});