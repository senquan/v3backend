import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from "typeorm";
import { Tag } from "./tag.model";

@Entity("gallery")
export class Gallery {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description: string | null = null;

  @Column({ name: "file_name", length: 255 })
  fileName!: string;

  @Column({ name: "file_path", length: 500 })
  filePath!: string;

  @Column({ name: "file_url", length: 500 })
  fileUrl!: string;

  @Column({ name: "file_size", type: "int", default: 0 })
  fileSize!: number;

  @Column({ name: "file_type", length: 50 })
  fileType!: string;

  @Column({ name: "mime_type", length: 100 })
  mimeType!: string;

  @Column({ type: "int", default: 0 })
  width!: number;

  @Column({ type: "int", default: 0 })
  height!: number;

  @Column({ type: 'varchar', name: "thumbnail_url", length: 255, nullable: true })
  thumbnailUrl: string | null = null;

  @Column({ type: "int", name: "category_id", nullable: true })
  categoryId: number | null = null;

  @Column({ type: 'varchar', name: "alt_text", length: 255, nullable: true })
  altText: string | null = null;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder!: number;

  @Column({ type: "tinyint", default: 1 })
  status!: number;

  @Column({ type: "int", unsigned: true, name: "upload_by", nullable: true })
  uploadBy: number | null = null;

  @Column({ type: "int", unsigned: true, name: "view_count", default: 0 })
  viewCount!: number;

  @Column({ type: "int", unsigned: true, name: "download_count", default: 0 })
  downloadCount!: number;

  @CreateDateColumn({ name: "create_at" })
  createAt!: Date;

  @UpdateDateColumn({ name: "update_at" })
  updateAt!: Date;

  @Column({ name: "is_deleted", type: "tinyint", default: 0 })
  isDeleted!: number;

  // 关联标签
  @ManyToMany(() => Tag, tag => tag.galleries)
  @JoinTable({
    name: "gallery_tags",
    joinColumn: {
      name: "gallery_id",
      referencedColumnName: "id"
    },
    inverseJoinColumn: {
      name: "tag_id",
      referencedColumnName: "id"
    }
  })
  tags!: Tag[];
}