import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../models/user.model';
import { Role } from '../../models/role.model';
import { Permission } from '../../models/permission.model';
import { Staff } from '../../models/staff.model';
import { Department } from '../../models/department.model';
import { Ticket } from '../../models/ticket.model';
import { TicketComment } from '../../models/ticket-comment.model';
import { TicketAttachment } from '../../models/ticket-attachment.model';
import { TicketDepartment } from '../../models/ticket-department.model';
import { Order } from '../../models/order.model';
import { OrderItem } from '../../models/order-item.model';
import { OrderStatusLog } from '../../models/order-status-log.model';
import { OrderCalculationLog } from '../../models/order-calculation-log.model';
import { Bulletin } from '../../models/bulletin.model';
import { Category } from '../../models/category.model';
import { Product } from '../../models/product.model';
import { Customer } from '../../models/customer.model';
import { Coupon } from '../../models/coupon.model';
import { CouponUser } from '../../models/coupon-user.model';
import { Promotion } from '../../models/promotion.model';
import { PromotionV3 } from '../../models/promotion-v3.model';
import { PromotionRule } from '../../models/promotion-rule.model';
import { PromotionRuleV3 } from '../../models/promotion-rule-v3.model';
import { Gallery } from '../../models/gallery.model';
import { Notification } from '../../models/notification.model';
import { ShortLink } from '../../models/short-link.model';
import { ExpressTracking } from '../../models/express-tracking.model';
import { ExpressCompany } from '../../models/express-company.model';
import { SystemLog } from '../../models/system-log.model';
import { TicketConfirmation } from '../../models/ticket-confirmation.model';
// import { LogChain } from '../../models/log-chain.model';
// import { LogArchive } from '../../models/log-archive.model';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || 'password',
      database: process.env.DB_NAME || 'cardbug',
      entities: [
        User, Role, Permission, Staff, Department,
        Ticket, TicketComment, TicketAttachment, TicketDepartment, TicketConfirmation,
        Order, OrderItem, OrderStatusLog, OrderCalculationLog,
        Bulletin, Category, Product, Customer, Coupon, CouponUser,
        Promotion, PromotionV3, PromotionRule, PromotionRuleV3,
        Gallery, Notification, ShortLink, ExpressTracking, ExpressCompany,
        SystemLog
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV !== 'production',
      retryAttempts: 0,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
