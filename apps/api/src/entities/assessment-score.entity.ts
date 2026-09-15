import {
  Column, CreateDateColumn, Entity, JoinColumn, Index, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { Assessment } from './assessment.entity';
import { Student } from './student.entity';
import { numericTransformer } from './numeric.transformer';

// One student's mark on one assessment.
@Entity('assessment_scores')
@Unique(['assessment_id', 'student_id'])
export class AssessmentScore {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  assessment_id: number;

  @Index()
  @Column()
  student_id: number;

  // Raw mark out of the assessment's max_score. Null when the student was
  // absent, which is different from scoring zero: an absence is excluded from
  // the average rather than dragging it down.
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true, transformer: numericTransformer })
  score: number | null;

  @Column({ default: false })
  is_absent: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Assessment, (a) => a.scores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment: Assessment;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;
}
