import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('company_info')
export class CompanyInfo {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 20, unique: true, comment: '单位编号' })
  companyCode: string | '' = '';

  @Column({ type: 'varchar', length: 100, comment: '单位名称' })
  companyName: string | '' = '';

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '账套编号' })
  accountCode: string | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '账套名称' })
  accountName: string | null = null;

  @Column({ type: 'bigint', nullable: true, comment: '上级单位ID' })
  parentCompanyId!: number | null;

  @Column({ type: 'int', default: 1, comment: '单位层级' })
  companyLevel!: number;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-启用，0-停用' })
  status!: number;

  @Column({ type: 'smallint', default: 0, comment: '是否删除：1-是，0-否' })
  isDeleted!: number;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', comment: '创建时间' })
  createdAt!: Date;

  @Column({ type: 'bigint', comment: '最后修改人' })
  updatedBy!: number;

  @Column({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP', 
    onUpdate: 'CURRENT_TIMESTAMP',
    comment: '修改时间' 
  })
  updatedAt!: Date;

  // 关系映射
  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updatedBy' })
  updater!: User;

  @ManyToOne(() => CompanyInfo, company => company.children)
  parentCompany: CompanyInfo | null = null;

  @OneToMany(() => CompanyInfo, company => company.parentCompany)
  children!: CompanyInfo[];
}