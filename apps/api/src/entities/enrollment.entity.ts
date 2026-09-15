import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Student } from './student.entity';
import { Zone } from './zone.entity';

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  student_id: number;

  @Column({ type: 'enum', enum: ['feeding', 'transport'] })
  type: 'feeding' | 'transport';

  @Column({ type: 'enum', enum: ['breakfast', 'lunch', 'both'], nullable: true })
  meal_type: 'breakfast' | 'lunch' | 'both';

  @Column({ nullable: true })
  zone_id: number;

  // Legacy single-payment fields (nullable — membership model uses `payments`)
  @Column({ type: 'date', nullable: true })
  payment_date: string;

  @Column({ type: 'int', nullable: true })
  duration_days: number;

  @Index()
  @Column({ type: 'date', nullable: true })
  expiry_date: string;

  // Monthly payment grid.
  //  Feeding  → keys "1B","1L","2B","2L",… (month + Breakfast/Lunch)
  //  Transport→ keys "1","2","3","4"        (month)
  @Column({ type: 'jsonb', default: () => "'{}'" })
  payments: Record<string, boolean>;

  @Column({ type: 'enum', enum: ['active', 'archived'], default: 'active' })
  status: 'active' | 'archived';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Student, (s) => s.enrollments, { onDelete: 'CASCADE' })
  student: Student;

  @ManyToOne(() => Zone, (z) => z.enrollments, { nullable: true, onDelete: 'SET NULL' })
  zone: Zone;
}
