import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('order_calculation_logs')
export class OrderCalculationLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  order_id!: number;

  @Column()
  product_id!: number;

  @Column()
  rule_id!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  discount_value!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  stepPrice!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @CreateDateColumn()
  created_at!: Date;
}