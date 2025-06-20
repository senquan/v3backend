import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './User.entity';

@Entity({ 
  name: 'branch',
  schema: 'sb' 
})
export class Branch {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  abbreviation: string | null = null;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  code!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  address: string | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contact: string | null = null;

  @Column({ type: 'boolean', default: false })
  for_analyze!: boolean;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn()
  created_time!: Date;

  @UpdateDateColumn()
  updated_time!: Date;

  // 关联关系
  @ManyToOne(() => User)
  @JoinColumn()
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn()
  updater!: User;

  @OneToMany(() => User, user => user.branch)
  users!: User[];
}