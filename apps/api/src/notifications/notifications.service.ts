import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationsService {
  private gateway: any;

  constructor(
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
  ) {}

  setGateway(gateway: any) {
    this.gateway = gateway;
  }

  async notify(
    userId: number,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    link: string | null = null,
  ) {
    const notification = this.notificationRepo.create({ user_id: userId, message, type, link });
    const saved = await this.notificationRepo.save(notification);

    // Push real-time via WebSocket if gateway is available
    if (this.gateway) {
      this.gateway.sendToUser(userId, saved);
    }

    return saved;
  }

  /**
   * Notify everyone holding any of the given roles.
   *
   * Supervisory events need to reach the dean and the principal together, and
   * doing that by querying one role per feature is how attendance ended up
   * reaching only deans despite reading as though it covered both.
   *
   * Inactive accounts are skipped — a departed member of staff should not
   * accumulate notifications.
   */
  async notifyRoles(
    roles: string[],
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    link: string | null = null,
  ) {
    if (!roles.length) return [];

    // role is a Postgres enum column, so it is cast to text before comparing —
    // matching it against a text[] directly raises "operator does not exist".
    const recipients: { id: number }[] = await this.notificationRepo.query(
      `SELECT id FROM users WHERE role::text = ANY($1::text[]) AND status = 'active'`,
      [roles],
    );

    return Promise.all(
      recipients.map((r) => this.notify(r.id, message, type, link)),
    );
  }

  // Only notifications from the current academic year — they reset on a new year.
  private activeYearStartClause = `n.created_at >= COALESCE(
    (SELECT created_at FROM academic_years WHERE status = 'active' ORDER BY created_at DESC LIMIT 1),
    '1970-01-01'::timestamp)`;

  async getForUser(userId: number) {
    return this.notificationRepo
      .createQueryBuilder('n')
      .where('n.user_id = :uid', { uid: userId })
      .andWhere(this.activeYearStartClause)
      .orderBy('n.created_at', 'DESC')
      .take(50)
      .getMany();
  }

  async markRead(notificationId: number, userId: number) {
    await this.notificationRepo.update({ id: notificationId, user_id: userId }, { is_read: true });
    return { message: 'Marked as read' };
  }

  async markAllRead(userId: number) {
    await this.notificationRepo.update({ user_id: userId, is_read: false }, { is_read: true });
    return { message: 'All marked as read' };
  }

  async getUnreadCount(userId: number) {
    return this.notificationRepo
      .createQueryBuilder('n')
      .where('n.user_id = :uid', { uid: userId })
      .andWhere('n.is_read = false')
      .andWhere(this.activeYearStartClause)
      .getCount();
  }
}
