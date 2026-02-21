import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from "typeorm";

@Entity("dict")
export class Dict {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null;

  @Column({ type: 'varchar', length: 45, default: "" })
  value!: string;

  @Column({ name: "group", type: "smallint", default: 0 })
  group!: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '图标' })
  icon: string | '' = '';

  @Column({ type: 'smallint', default: 0, comment: '排序' })
  sort!: number;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}