import {
  Column, CreateDateColumn, Entity, JoinColumn, Index, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { PLevel } from './p-level.entity';
import { CourseCatalogue } from './course-catalogue.entity';

// A subject taught at one P-level. Scoped per level because P1 and P6 do not
// take the same subjects — the same shape the timetable's courses_config uses.
@Entity('subjects')
@Unique(['p_level_id', 'code'])
export class Subject {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  p_level_id: number;

  @Column({ length: 80 })
  name: string;

  // Short form used on the report card, where a full subject name will not fit.
  @Column({ length: 16 })
  code: string;

  // Order the subject appears in on the report card.
  @Column({ type: 'int', default: 0 })
  display_order: number;

  // ── Curriculum rules ───────────────────────────────────────────────────────
  //
  // How much of this subject a class gets each week, and how much of it should
  // run back-to-back. These belong to the subject rather than to whoever
  // teaches it: P4 Mathematics is five periods a week no matter who takes it.
  //
  // They are per P-level because P1 Mathematics and P6 Mathematics are
  // different subjects with different demands — which is exactly why subjects
  // are scoped to a level.
  //
  // The timetable reads these, so the dean sets them once here instead of
  // re-entering them for every plan.
  @Column({ type: 'int', default: 5 })
  periods_per_week: number;

  // Minimum consecutive periods when this subject is scheduled. 1 means single
  // periods are fine; 2 pairs it up, which suits subjects needing a longer run.
  @Column({ type: 'int', default: 1 })
  min_consecutive: number;

  // Set when this subject was created from the course catalogue. Null for
  // subjects added manually before the catalogue existed.
  @Column({ nullable: true })
  catalogue_id: number | null;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => PLevel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'p_level_id' })
  p_level: PLevel;

  @ManyToOne(() => CourseCatalogue, (c) => c.subjects, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'catalogue_id' })
  catalogue_entry: CourseCatalogue;
}
