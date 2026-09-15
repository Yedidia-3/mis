import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';

@Entity('attendance')
@Unique(['student_id', 'date']) // one record per student per day
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  student_id: number;

  @Index()
  @Column()
  class_id: number;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'enum', enum: ['present', 'absent', 'late'], default: 'present' })
  status: 'present' | 'absent' | 'late';

  @Column({ nullable: true })
  marked_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
