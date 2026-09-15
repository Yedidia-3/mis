import {
  Column, CreateDateColumn, Entity, JoinColumn, Index, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { AcademicYear } from './academic-year.entity';
import { numericTransformer } from './numeric.transformer';

// The kinds of assessment a teacher may record, and how much each counts
// toward the term grade. The dean maintains these; teachers pick from them and
// cannot invent their own.
//
// Scoped to an academic year so the grading policy is part of that year's
// record. Changing next year's weights leaves last year's report cards
// reproducible.
@Entity('assessment_types')
@Unique(['academic_year_id', 'name'])
export class AssessmentType {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  academic_year_id: number;

  @Column({ length: 60 })
  name: string;

  // Percentage contribution to the subject grade. Across the active types of
  // one year these are expected to total 100.
  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: numericTransformer })
  weight: number;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_year_id' })
  academic_year: AcademicYear;
}
