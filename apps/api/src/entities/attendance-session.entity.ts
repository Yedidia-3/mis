import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';

// One submitted attendance record per class per day. Its existence locks the
// day's attendance (one-per-day); a reset deletes it so the teacher can redo.
@Entity('attendance_sessions')
@Unique(['class_id', 'date'])
export class AttendanceSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  class_id: number;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Column()
  marked_by: number;

  @Column({ type: 'int', default: 0 })
  present: number;

  @Column({ type: 'int', default: 0 })
  absent: number;

  @Column({ type: 'int', default: 0 })
  late: number;

  @Column({ type: 'int', default: 0 })
  total: number;

  @Column({ type: 'timestamp' })
  submitted_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
