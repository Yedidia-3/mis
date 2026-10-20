import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';

/**
 * One row for the whole school. The accountant sets breakfast and lunch once;
 * every feeding tick loads that price instead of asking again.
 */
@Entity('feeding_prices')
export class FeedingPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  breakfast: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  lunch: number;

  @UpdateDateColumn()
  updated_at: Date;
}
