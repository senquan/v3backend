import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TicketFollowUpConfig } from './ticket-follow-up-config.model';

@Entity('ticket_follow_up_stages')
export class TicketFollowUpStage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'config_id', type: 'int', comment: '关联配置ID' })
  configId!: number;

  @ManyToOne(() => TicketFollowUpConfig, config => config.stages)
  @JoinColumn({ name: 'config_id' })
  config!: TicketFollowUpConfig;

  @Column({ name: 'stage_order', type: 'tinyint', comment: '阶段序号（1-7）' })
  stageOrder!: number;

  @Column({ name: 'offset_hours', type: 'decimal', precision: 5, scale: 1, comment: '相对上一轮的偏移小时数' })
  offsetHours!: number;

  @Column({ name: 'cumulative_hours', type: 'decimal', precision: 7, scale: 1, comment: '累计小时数（相对算单时间）' })
  cumulativeHours!: number;

  @Column({ name: 'script_name', length: 50, comment: '话术名称（如话术A）' })
  scriptName!: string;

  @Column({ type: 'text', comment: '跟单话术内容' })
  script!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
