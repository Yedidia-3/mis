import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  actor_id: number;

  @Column({ default: 'System' })
  actor_name: string;

  @Column({ default: 'system' })
  actor_role: string;

  @Column({ nullable: true })
  target_type: string;

  @Column({ nullable: true })
  target_id: number;

  @Column({ nullable: true })
  target_name: string;

  @Column()
  action: string;

  @Column({ type: 'text', default: '' })
  details: string;

  @Column({ default: '—' })
  ip_address: string;
}
