import { Entity, PrimaryColumn, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Dict } from './dict.model';
import { Tag } from './tag.model';

@Entity('platform_tags')
export class PlatformTags {
  @PrimaryColumn({ name: 'platform_id' })
  @Index()
  platformId!: number;

  @PrimaryColumn({ name: 'tag_id' })
  @Index()
  tagId!: number;

  @ManyToOne(() => Tag)
  @JoinColumn({ name: 'tag_id' })
  tag!: Tag;

  platformInfo?: Dict;
}