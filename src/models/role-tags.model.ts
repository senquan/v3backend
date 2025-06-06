import { Entity, PrimaryColumn, Index } from 'typeorm';

@Entity('role_tags')
export class RoleTags {
  @PrimaryColumn({ name: 'role_id' })
  @Index()
  roleId!: number;

  @PrimaryColumn({ name: 'tag_id' })
  @Index()
  tagId!: number;
}