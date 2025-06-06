import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ProductSeries } from './product-series.model';
import { Tag } from './tag.model';

@Entity('product_series_tags')
export class ProductSeriesTag {
  @PrimaryColumn({ name: 'series_id' })
  @Index()
  seriesId!: number;

  @PrimaryColumn({ name: 'tag_id' })
  @Index()
  tagId!: number;

  @ManyToOne(() => ProductSeries, series => series.tags, {
    onDelete: "CASCADE"
  })
  @JoinColumn({ name: "series_id" })
  series!: ProductSeries;

  @ManyToOne(() => Tag, tag => tag.series, {
    onDelete: "CASCADE"
  })
  @JoinColumn({ name: "tag_id" })
  tag!: Tag;
}