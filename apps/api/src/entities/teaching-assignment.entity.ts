import {
  Column, CreateDateColumn, Entity, JoinColumn, Index, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { Class } from './class.entity';
import { Subject } from './subject.entity';
import { User } from './user.entity';

/**
 * Who teaches which subject to which class.
 *
 * This is the fact the school already knows and used to re-type into every
 * timetable plan as free text. Holding it as data means the timetable, the
 * teacher's own portal and the assessment permissions all read the same
 * source, and a teacher's name can never drift out of sync with their account.
 *
 * Deliberately thin: it carries no periods or scheduling rules. How long a
 * subject runs each week belongs to the subject, because P4 Mathematics is
 * five periods whoever teaches it. A teacher's workload is therefore derived
 * — the sum of their subjects' periods — rather than typed in and left to rot.
 *
 * For P1–3, where one teacher takes every subject, these rows are generated
 * automatically when a class teacher is assigned. Only P4–6 specialists need
 * entering by hand.
 */
@Entity('teaching_assignments')
// One subject in one class has exactly one teacher. Without this, two teachers
// could both claim P4A Mathematics and the solver would double-book the slot.
@Unique(['class_id', 'subject_id'])
export class TeachingAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  teacher_id: number;

  @Index()
  @Column()
  class_id: number;

  @Index()
  @Column()
  subject_id: number;

  // True when the row was created automatically for a P1–3 class teacher, so
  // the UI can show it as inherited rather than as something typed in — and so
  // reassigning that class can clean its own generated rows up.
  @Column({ default: false })
  is_auto_generated: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;
}
