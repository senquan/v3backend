import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { ReturnOrder } from "./return-order.model";
import { Product } from "./product.model";
import { OrderItem } from "./order-item.model";

@Entity("return_order_items")
export class ReturnOrderItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'return_order_id' })
  returnOrderId!: number;

  @ManyToOne(() => ReturnOrder, returnOrder => returnOrder.items)
  @JoinColumn({ name: 'return_order_id' })
  returnOrder!: ReturnOrder;

  @Column({ name: 'order_item_id' })
  orderItemId!: number;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: 'order_item_id' })
  orderItem!: OrderItem;

  @Column({ name: 'product_id' })
  productId!: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice!: number;

  @Column({ name: 'quantity', type: 'decimal', precision: 5, scale: 2 })
  quantity!: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 2 })
  totalPrice!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null = null;
}