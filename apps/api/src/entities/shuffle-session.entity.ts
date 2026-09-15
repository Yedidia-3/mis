import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AcademicYear } from './academic-year.entity';
import { PLevel } from './p-level.entity';
import { User } from './user.entity';
import { ShuffleResult } from './shuffle-result.entity';

export type ShuffleAlgorithm =
  | 'balanced_average'
  | 'round_robin'
  | 'balanced_bands'
  | 'snake_draft'
  | 'auto_promote';
export type ShuffleStatus = 'in_progress' | 'pending_approval' | 'approved' | 'rejected' | 'distributed';

@Entity('shuffle_sessions')
export class ShuffleSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  academic_year_id: number;

  @Column()
  p_level_id: number;

  @Column({
    type: 'enum',
    enum: ['balanced_average', 'round_robin', 'balanced_bands', 'snake_draft', 'auto_promote'],
  })
  algorithm: ShuffleAlgorithm;

  @Column({ type: 'enum', enum: ['in_progress', 'pending_approval', 'approved', 'rejected', 'distributed'], default: 'in_progress' })
  status: ShuffleStatus;

  @Column()
  submitted_by: number;

  @Column({ nullable: true })
  reviewed_by: number;

  @Column({ type: 'text', nullable: true })
  rejection_note: string;

  @Column({ type: 'timestamp', nullable: true })
  submitted_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  distributed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => AcademicYear, (ay) => ay.shuffle_sessions, { onDelete: 'CASCADE' })
  academic_year: AcademicYear;

  @ManyToOne(() => PLevel, (pl) => pl.shuffle_sessions, { onDelete: 'CASCADE' })
  p_level: PLevel;

  @ManyToOne(() => User, (u) => u.submitted_sessions)
  submitted_by_user: User;

  @ManyToOne(() => User, (u) => u.reviewed_sessions, { nullable: true })
  reviewed_by_user: User;

  @OneToMany(() => ShuffleResult, (sr) => sr.shuffle_session)
  results: ShuffleResult[];
}
