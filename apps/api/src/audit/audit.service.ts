import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog) private repo: Repository<AuditLog>,
  ) {}

  // Fire-and-forget: never let audit logging break the request.
  async log(params: {
    actor_id?: number;
    actor_name?: string;
    actor_role?: string;
    target_type?: string;
    target_id?: number;
    target_name?: string;
    action: string;
    details?: string;
    ip_address?: string;
  }) {
    try {
      await this.repo.save(
        this.repo.create({
          actor_id: params.actor_id ?? null,
          actor_name: params.actor_name || 'System',
          actor_role: params.actor_role || 'system',
          target_type: params.target_type ?? null,
          target_id: params.target_id ?? null,
          target_name: params.target_name ?? null,
          action: params.action,
          details: params.details ?? '',
          ip_address: params.ip_address || '—',
        }),
      );
    } catch (e) {
      this.logger.warn(`Failed to write audit log: ${(e as Error).message}`);
    }
  }

  async list(limit = 500) {
    const rows = await this.repo.find({ order: { created_at: 'DESC' }, take: limit });
    return rows.map((r) => ({
      timestamp: r.created_at,
      user: r.actor_name,
      role: r.actor_role,
      target_type: r.target_type,
      target_id: r.target_id,
      target_name: r.target_name,
      action: r.action,
      details: r.details,
      ip_address: r.ip_address,
    }));
  }
}
