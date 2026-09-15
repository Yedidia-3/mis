import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PLevel } from './p-level.entity';
import { User } from './user.entity';
import { Student } from './student.entity';
import { ShuffleResult } from './shuffle-result.entity';

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  p_level_id: number;

  @Column({ length: 5 })
  name: string;

  @Column({ nullable: true })
  teacher_id: number;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  // Set when the Dean distributes the class list. Until this is set, the class
  // is not yet "live" — teachers and the accountant do not see it.
  @Column({ type: 'timestamp', nullable: true })
  distributed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => PLevel, (pl) => pl.classes, { onDelete: 'CASCADE' })
  p_level: PLevel;

  @ManyToOne(() => User, (u) => u.classes, { nullable: true, onDelete: 'SET NULL' })
  teacher: User;

  @OneToMany(() => Student, (s) => s.current_class)
  students: Student[];

  @OneToMany(() => ShuffleResult, (sr) => sr.proposed_class)
  shuffle_results: ShuffleResult[];
}
