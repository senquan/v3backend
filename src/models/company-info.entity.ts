import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';

@Entity('company_info')
export class CompanyInfo {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 20, unique: true, comment: '单位编号' })
  companyCode: string | '' = '';

  @Column({ type: 'varchar', length: 100, comment: '单位名称' })
  companyName: string | '' = '';

  @Column({ type: 'bigint', nullable: true, comment: '上级单位ID' })
  parentCompanyId!: number | null;

  @Column({ type: 'int', default: 1, comment: '单位层级' })
  companyLevel!: number;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-启用，0-停用' })
  status!: number;

  @Column({ type: 'varchar', length: 50, comment: '创建人' })
  createdBy!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', comment: '创建时间' })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 50, comment: '修改人' })
  updatedBy: string | '' = '';

  @Column({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP', 
    onUpdate: 'CURRENT_TIMESTAMP',
    comment: '修改时间' 
  })
  updatedAt!: Date;

  // 关系映射
  @ManyToOne(() => CompanyInfo, company => company.children)
  parentCompany: CompanyInfo | null = null;

  @OneToMany(() => CompanyInfo, company => company.parentCompany)
  children!: CompanyInfo[];
}