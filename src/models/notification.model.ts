import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  avatar: string | null = null;

  @Column()
  title!: string;

  @Column('text', { nullable: true })
  description: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  extra: string | null = null;

  @Column({ 
    type: 'enum',
    enum: ['info', 'success', 'warning', 'danger', 'primary'],
    default: 'info'
  })
  status!: string;

  @Column({ 
    type: 'enum',
    enum: ['notification', 'message', 'todo'],
    default: 'notification'
  })
  type!: string;

  @Column({ name: 'is_read', default: false })
  isRead!: boolean;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null = null;

  @Column({ name: 'target_url', type: 'varchar', length: 255, nullable: true })
  targetUrl: string | null = null;

  @Column({ name: 'action_type', type: 'varchar', nullable: true })
  actionType: string | null = null;

  @Column({ name: 'action_data', type: 'varchar', length: 100, nullable: true })
  actionData: string | null = null;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // 格式化时间显示
  getFormattedDatetime(): string {
    const now = new Date();
    const diff = now.getTime() - this.createdAt.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 365) {
      return `${Math.floor(days / 365)}年前`;
    } else if (days > 30) {
      return `${Math.floor(days / 30)}个月前`;
    } else if (days > 0) {
      return `${days}天前`;
    } else if (hours > 0) {
      return `${hours}小时前`;
    } else if (minutes > 0) {
      return `${minutes}分钟前`;
    } else {
      return '刚刚';
    }
  }

  // 标记为已读
  markAsRead(): void {
    this.isRead = true;
    this.updatedAt = new Date();
  }

  // 获取状态颜色
  getStatusColor(): string {
    const colorMap: { [key: string]: string } = {
      'info': '#909399',
      'success': '#67C23A',
      'warning': '#E6A23C',
      'danger': '#F56C6C',
      'primary': '#409EFF'
    };
    return colorMap[this.status] || colorMap['info'];
  }
}