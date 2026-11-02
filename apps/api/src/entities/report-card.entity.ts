import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';
import { Student } from './student.entity';

export type ReportKind = 'mid_term' | 'end_of_term' | 'end_of_year';
export const REPORT_KINDS: ReportKind[] = ['mid_term', 'end_of_term', 'end_of_year'];

// A generated bulletin, frozen at the moment the dean generated it so a
// printed report can always be reproduced even after marks are corrected.
@Entity('report_cards')
export class ReportCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  student_id: number;

  @Index()
  @Column({ nullable: true })
  class_id: number | null;

  @Column()
  academic_year_id: number;

  @Column({ nullable: true })
  term_id: number | null;

  @Column({ type: 'enum', enum: REPORT_KINDS, enumName: 'report_cards_kind_enum' })
  kind: ReportKind;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'int', default: 0 })
  flagged_count: number;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true, transformer: numericTransformer })
  total: number | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true, transformer: numericTransformer })
  max_total: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  percentage: number | null;

  @Column({ type: 'int', nullable: true })
  position: number | null;

  @Column({ type: 'int', nullable: true })
  class_size: number | null;

  @Column({ nullable: true })
  generated_by: number | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  generated_at: Date;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;
}
