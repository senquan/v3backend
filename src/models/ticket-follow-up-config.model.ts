import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { TicketFollowUpStage } from './ticket-follow-up-stage.model';

@Entity('ticket_follow_up_configs')
export class TicketFollowUpConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100, comment: '配置名称' })
  name!: string;

  @Column({ name: 'platform_id', type: 'int', nullable: true, comment: '适用平台ID（null=全部）' })
  platformId: number | null = null;

  @Column({ name: 'base_hours', type: 'decimal', precision: 5, scale: 1, default: 24, comment: '基础时间x（小时）' })
  baseHours!: number;

  @Column({ name: 'is_active', type: 'tinyint', default: 1, comment: '是否启用' })
  isActive!: number;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => TicketFollowUpStage, stage => stage.config)
  stages!: TicketFollowUpStage[];
}
