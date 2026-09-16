import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
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
   * the lower primary years. Assigning that teacher to the class is enough:
   * their subject assignments are generated from the level's subjects, so the
   * dean enters nothing further.
   *
   * 'specialist' — subjects are taught by different teachers across classes,
   * as in the upper years, so each teacher's subjects are assigned explicitly.
   *
   * Held as data rather than inferred from the level's name, because "P1" is
   * a label the school controls and code should not depend on how it is spelt.
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
  academic_year: AcademicYear;

  @OneToMany(() => Class, (c) => c.p_level)
  classes: Class[];

  @OneToMany(() => ShuffleSession, (ss) => ss.p_level)
  shuffle_sessions: ShuffleSession[];
}
