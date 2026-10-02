import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AcademicYear } from './academic-year.entity';
import { Class } from './class.entity';
import { ShuffleResult } from './shuffle-result.entity';
import { Enrollment } from './enrollment.entity';
import { User } from './user.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  academic_year_id: number;

  @Index()
  @Column({ length: 50, nullable: true })
  student_id_number: string;

  @Column({ length: 100 })
  name: string;

  @Index()
  @Column({ nullable: true })
  current_class_id: number;

  @Column({ length: 10, nullable: true })
  former_class: string;

  @Column({ nullable: true })
  rank: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  marks_percentage: number;

  @Column({ type: 'enum', enum: ['active', 'repeating', 'promoted', 'transferred'], default: 'active' })
  status: 'active' | 'repeating' | 'promoted' | 'transferred';

  @Column({ default: false })
  is_imported: boolean;

  @Column({ nullable: true })
  imported_by_user_id: number;

  @Column({ type: 'timestamp', nullable: true })
  imported_at: Date;

  @Column({ length: 20, default: 'approved' })
  approval_status: 'pending' | 'approved' | 'rejected';

  @Column({ nullable: true })
  approved_by_user_id: number;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'imported_by_user_id' })
  imported_by_user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by_user_id' })
  approved_by_user: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => AcademicYear, (ay) => ay.students, { onDelete: 'CASCADE' })
  academic_year: AcademicYear;

  @ManyToOne(() => Class, (c) => c.students, { nullable: true, onDelete: 'SET NULL' })
  current_class: Class;

  @OneToMany(() => ShuffleResult, (sr) => sr.student)
  shuffle_results: ShuffleResult[];

  @OneToMany(() => Enrollment, (e) => e.student)
  enrollments: Enrollment[];
}
