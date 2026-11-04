import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AcademicYear } from './academic-year.entity';
import { Class } from './class.entity';
import { ShuffleSession } from './shuffle-session.entity';

@Entity('p_levels')
export class PLevel {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  academic_year_id: number;

  @Column({ length: 10 })
  name: string;

  /**
   * How teaching is organised at this level.
   *
   * 'class_teacher' — one teacher takes every subject for their class, as in
   * nursery and P1–P2. Assigning that teacher to the class is enough: their
   * subject assignments are generated from the level's subjects.
   *
   * 'specialist' — subjects are taught by different teachers, as in P3–P6
   * (e.g. one for English, one for Maths, one for Kinyarwanda & French). Each
   * teacher's subjects are assigned explicitly on Teacher Assignments.
   *
   * New levels default from their name (P3–P6 → specialist). The stored value
   * is what the app uses afterwards, so the dean can override it.
   */
  @Column({ type: 'enum', enum: ['class_teacher', 'specialist'], default: 'class_teacher' })
  teaching_model: 'class_teacher' | 'specialist';

  /**
   * The most periods a week a teacher at this level should be scheduled for.
   *
   * A cap rather than a target: assignment validation prevents workloads
   * beyond it. Levels differ, which is why it lives here and not on the user.
   */
  @Column({ type: 'int', default: 30 })
  max_periods_per_teacher: number;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => AcademicYear, (ay) => ay.p_levels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_year_id' })
  academic_year: AcademicYear;

  @OneToMany(() => Class, (c) => c.p_level)
  classes: Class[];

  @OneToMany(() => ShuffleSession, (ss) => ss.p_level)
  shuffle_sessions: ShuffleSession[];
}
