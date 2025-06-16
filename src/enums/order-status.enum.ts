// 普通订单状态
export enum OrderStatus {
  DRAFT = -1,         // 草稿
  PENDING = 0,       // 待处理
  PAID = 1,          // 已支付
  PROCESSING = 2,    // 处理中
  SHIPPED = 3,       // 已发货
  DELIVERED = 4,     // 已送达
  INSERVICE = 5,     // 售后中
  COMPLETED = 6,     // 已完成
  CANCELLED = 7,     // 已取消
}

// 退货订单状态
export enum ReturnOrderStatus {
  PENDING = 0,       // 待处理
  APPROVED = 1,      // 已批准
  REJECTED = 2,      // 已拒绝
  RETURNING = 3,     // 退货中
  RECEIVED = 4,      // 已收到退货
  REFUNDED = 5,      // 已退款
  COMPLETED = 6,     // 已完成
  CANCELLED = 7,     // 已取消
}