import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ShuffleSession } from './shuffle-session.entity';
import { Student } from './student.entity';
import { Class } from './class.entity';

@Entity('shuffle_results')
export class ShuffleResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  shuffle_session_id: number;

  @Column()
  student_id: number;

  @Column()
  proposed_class_id: number;

  @Column({ default: false })
  is_manual_override: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => ShuffleSession, (ss) => ss.results, { onDelete: 'CASCADE' })
  shuffle_session: ShuffleSession;

  @ManyToOne(() => Student, (s) => s.shuffle_results, { onDelete: 'CASCADE' })
  student: Student;

  @ManyToOne(() => Class, (c) => c.shuffle_results, { onDelete: 'CASCADE' })
  proposed_class: Class;
}
