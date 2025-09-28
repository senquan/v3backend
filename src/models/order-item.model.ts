import { Entity, PrimaryGeneratedColumn, JoinColumn, Column, ManyToOne } from "typeorm";
import { Order } from "./order.model";
import { Product } from "./product.model";

@Entity("order_items")
export class OrderItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'product_id' })
  productId!: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice!: number;

  @Column()
  quantity!: number;

  @Column({ name: 'discount', type: 'decimal', precision: 5, scale: 4, nullable: false, default: 0, comment: '折扣率, 如0.85表示85折' })
  discount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalPrice!: number;

  @Column({ name: 'order_id' })
  orderId!: number;

  @ManyToOne(() => Order, order => order.items)
  @JoinColumn({ name: 'order_id' })
  order!: Order;
}