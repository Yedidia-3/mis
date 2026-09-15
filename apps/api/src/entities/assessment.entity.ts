import {
  Column, CreateDateColumn, Entity, JoinColumn, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { AssessmentScore } from './assessment-score.entity';
import { AssessmentType } from './assessment-type.entity';
import { Class } from './class.entity';
import { Subject } from './subject.entity';
import { Term } from './term.entity';
import { User } from './user.entity';
import { numericTransformer } from './numeric.transformer';

// One piece of assessed work for one class in one subject — a quiz, a homework,
// an exam. The individual marks live in assessment_scores.
@Entity('assessments')
export class Assessment {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  class_id: number;

  @Index()
  @Column()
  subject_id: number;

  @Index()
  @Column()
  assessment_type_id: number;

  @Index()
  @Column()
  term_id: number;

  @Column({ length: 120 })
  title: string;

  @Column({ type: 'date' })
  date: string;

  // What the assessment was marked out of. Scores are stored as raw marks and
  // converted to percentages only when grades are computed, so the original
  // mark the teacher wrote down is never lost to rounding.
  @Column({ type: 'numeric', precision: 6, scale: 2, transformer: numericTransformer })
  max_score: number;

  // Drafts are the teacher's alone. Submitting is what notifies the dean and
  // principal and what makes the marks count toward a grade.
  @Column({ type: 'enum', enum: ['draft', 'submitted'], default: 'draft' })
  status: 'draft' | 'submitted';

  @Column({ type: 'timestamp', nullable: true })
  submitted_at: Date;

  @Index()
  @Column()
  created_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @ManyToOne(() => Subject, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @ManyToOne(() => AssessmentType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assessment_type_id' })
  assessment_type: AssessmentType;

  @ManyToOne(() => Term, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'term_id' })
  term: Term;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User;

  @OneToMany(() => AssessmentScore, (s) => s.assessment)
  scores: AssessmentScore[];
}
