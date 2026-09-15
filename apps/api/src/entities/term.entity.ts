import {
  Column, CreateDateColumn, Entity, JoinColumn, Index, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { AcademicYear } from './academic-year.entity';

// A reporting period within an academic year — Rwandan primary schools run
// three. Report cards are issued per term, so every assessment belongs to one.
@Entity('terms')
@Unique(['academic_year_id', 'sequence'])
export class Term {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  academic_year_id: number;

  @Column({ length: 40 })
  name: string;

  // 1, 2, 3 — the order terms run in, independent of their display name.
  @Column({ type: 'int' })
  sequence: number;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  // 'closed' means marks are final; report cards are generated from closed terms.
  @Column({ type: 'enum', enum: ['upcoming', 'active', 'closed'], default: 'upcoming' })
  status: 'upcoming' | 'active' | 'closed';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_year_id' })
  academic_year: AcademicYear;
}
