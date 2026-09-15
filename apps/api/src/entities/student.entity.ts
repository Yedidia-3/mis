import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AcademicYear } from './academic-year.entity';
import { Class } from './class.entity';
import { ShuffleResult } from './shuffle-result.entity';
import { Enrollment } from './enrollment.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  academic_year_id: number;

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
