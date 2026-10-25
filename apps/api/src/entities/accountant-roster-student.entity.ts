import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Snapshot the accountant receives after accepting a distribution notice. */
@Entity('accountant_roster_students')
@Unique('uq_roster_user_year_student', ['user_id', 'academic_year_id', 'student_id'])
export class AccountantRosterStudent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  user_id: number;

  @Index()
  @Column()
  academic_year_id: number;

  @Column()
  student_id: number;

  @Column({ length: 50, nullable: true })
  student_id_number: string | null;

  @Column({ length: 100 })
  student_name: string;

  @Column({ nullable: true })
  class_id: number | null;

  @Column({ length: 20 })
  class_name: string;

  @Column({ nullable: true })
  p_level_id: number | null;

  @Column({ length: 20 })
  p_level_name: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  accepted_at: Date;
}
