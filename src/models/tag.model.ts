import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToMany } from "typeorm";
import { Product } from "./product.model";
import { ProductSeries } from "./product-series.model";
import { Role } from './role.model';
import { Gallery } from './gallery.model';

@Entity("tags")
export class Tag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 50 })
  name!: string;

  @Column({ length: 20, default: "#409EFF" })
  color!: string;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @Column({ name: "is_deleted", default: 0 })
  isDeleted!: number;

  @ManyToMany(() => Product, product => product.tags)
  products!: Product[];

  @ManyToMany(() => ProductSeries, series => series.tags)
  series!: ProductSeries[];

  @ManyToMany(() => Role, role => role.tags)
  roles!: Role[];

  @ManyToMany(() => Gallery, gallery => gallery.tags)
  galleries!: Gallery[];
}