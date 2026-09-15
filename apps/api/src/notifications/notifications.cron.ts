import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AccountantService } from '../accountant/accountant.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ExpiryCheckerCron {
  private readonly logger = new Logger(ExpiryCheckerCron.name);

  constructor(
    private accountantService: AccountantService,
    private notificationsService: NotificationsService,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  @Cron('0 7 * * *') // Every day at 07:00
  async checkExpiry() {
    this.logger.log('Running subscription expiry check...');

    const accountants = await this.userRepo.find({ where: { role: 'accountant', status: 'active' } });
    if (!accountants.length) return;

    for (const days of [3, 2, 1, 0]) {
      const expiring = await this.accountantService.getEnrollmentsExpiringInDays(days);
      for (const item of expiring) {
        const message = days === 0
          ? `${item.studentName} — ${item.label} payment has expired today.`
          : `${item.studentName} — ${item.label} payment expires in ${days} day${days > 1 ? 's' : ''}.`;

        for (const accountant of accountants) {
          await this.notificationsService.notify(accountant.id, message, days === 0 ? 'error' : 'warning');
        }
      }
    }

    this.logger.log('Expiry check complete');
  }
}
