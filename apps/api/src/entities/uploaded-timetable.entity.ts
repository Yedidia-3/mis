import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('uploaded_timetables')
export class UploadedTimetable {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  name?: string;

  @Column({ type: 'int', nullable: true })
  academic_year_id?: number;

  @Column({ type: 'int', nullable: true })
  uploaded_by?: number;

  @Column({ type: 'jsonb' })
  data: any;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
