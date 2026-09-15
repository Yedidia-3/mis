import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PLevel } from './p-level.entity';
import { Student } from './student.entity';
import { ShuffleSession } from './shuffle-session.entity';

@Entity('academic_years')
export class AcademicYear {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  name: string;

  @Column({ type: 'enum', enum: ['active', 'archived'], default: 'active' })
  status: 'active' | 'archived';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  archived_at: Date;

  // Deletion requires Principal approval. Flow: admin requests → principal
  // approves (year is deleted) or rejects (request cleared).
  @Column({ type: 'enum', enum: ['none', 'pending', 'rejected'], default: 'none' })
  deletion_status: 'none' | 'pending' | 'rejected';

  @Column({ type: 'timestamp', nullable: true })
  deletion_requested_at: Date;

  @OneToMany(() => PLevel, (pl) => pl.academic_year)
  p_levels: PLevel[];

  @OneToMany(() => Student, (s) => s.academic_year)
  students: Student[];

  @OneToMany(() => ShuffleSession, (ss) => ss.academic_year)
  shuffle_sessions: ShuffleSession[];
}
