import { Entity, PrimaryColumn, Index } from 'typeorm';
import { Dict } from './dict.model';

@Entity('platform_tags')
export class PlatformTags {
  @PrimaryColumn({ name: 'platform_id' })
  @Index()
  platformId!: number;

  @PrimaryColumn({ name: 'tag_id' })
  @Index()
  tagId!: number;

  platformInfo?: Dict;
}