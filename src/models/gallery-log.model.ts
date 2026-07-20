import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from "typeorm"

@Entity("gallery_log")
export class GalleryLog {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: "gallery_id", type: "int" })
  galleryId!: number

  @Column({ name: "platform_id", type: "int", nullable: true })
  platformId: number | null = null

  @Column({ name: "channel", type: "varchar", length: 255, nullable: true })
  channel: string | null = null

  @Column({ name: "user_id", type: "int", unsigned: true, nullable: true })
  userId: number | null = null

  @CreateDateColumn({ name: "create_at" })
  createAt!: Date
}
