import {
  Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { Subject } from './subject.entity';

/**
 * School-wide course catalogue — the dean defines courses once here and then
 * assigns them to p-levels rather than retyping the same names six times.
 *
 * Not scoped to an academic year: Mathematics is Mathematics every year.
 * Per-level customisation (periods/week, min consecutive) lives on Subject,
 * which is the catalogue entry stamped onto a specific p-level.
 */
@Entity('course_catalogue')
@Unique(['code'])
export class CourseCatalogue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  name: string;

  @Column({ length: 16 })
  code: string;

  // Defaults copied onto Subject when the course is assigned to a p-level.
  // The dean can override them per-level on the Subject afterwards.
  @Column({ type: 'int', default: 5 })
  default_periods_per_week: number;

  @Column({ type: 'int', default: 1 })
  default_min_consecutive: number;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Subject, (s) => s.catalogue_entry)
  subjects: Subject[];
}
