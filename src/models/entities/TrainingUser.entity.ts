import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tr_user')
export class TrainingUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', default: 0 })
  global_id!: number;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  realname!: string;

  @Column({ type: 'smallint', default: 1 })
  type!: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  wechat_unionid: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  wechat_openid: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  avatar: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  province: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  gender: string | null = null;

  @Column({ type: 'integer', default: 0 })
  is_deleted!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}