import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  user_id: number;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: ['info', 'success', 'warning', 'error'], default: 'info' })
  type: 'info' | 'success' | 'warning' | 'error';

  @Column({ default: false })
  is_read: boolean;

  // Where clicking the notification should take the recipient, as an in-app
  // path such as "/dean/assessments/42". Nullable — notifications that are
  // purely informational have nowhere to go.
  @Column({ type: 'text', nullable: true })
  link: string | null;

  // Set when the recipient must accept before anything is copied into their portal.
  @Column({ default: false })
  requires_action: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  action_status: 'pending' | 'accepted' | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, (u) => u.notifications, { onDelete: 'CASCADE' })
  user: User;
}
