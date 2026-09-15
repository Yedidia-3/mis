import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { Class } from './class.entity';
import { Notification } from './notification.entity';
import { ShuffleSession } from './shuffle-session.entity';

export type UserRole = 'super_admin' | 'dean' | 'principal' | 'teacher' | 'accountant';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ type: 'enum', enum: ['super_admin', 'dean', 'principal', 'teacher', 'accountant'] })
  role: UserRole;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  // Small avatar stored as a data URL (resized client-side before upload)
  @Column({ type: 'text', nullable: true })
  avatar: string;

  @Column({ default: true })
  must_change_password: boolean;

  @Column({ type: 'int', default: 0 })
  failed_login_attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  locked_until: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_login: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Class, (c) => c.teacher)
  classes: Class[];

  @OneToMany(() => Notification, (n) => n.user)
  notifications: Notification[];

  @OneToMany(() => ShuffleSession, (ss) => ss.submitted_by_user)
  submitted_sessions: ShuffleSession[];

  @OneToMany(() => ShuffleSession, (ss) => ss.reviewed_by_user)
  reviewed_sessions: ShuffleSession[];
}
