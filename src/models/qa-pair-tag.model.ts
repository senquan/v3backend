import { Entity, PrimaryColumn, Index } from 'typeorm';

@Entity('qa_pair_tags')
export class QaPairTag {
  @PrimaryColumn({ name: 'qa_pair_id' })
  @Index()
  qaPairId!: number;

  @PrimaryColumn({ name: 'tag_id' })
  @Index()
  tagId!: number;
}
