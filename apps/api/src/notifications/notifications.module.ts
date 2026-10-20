import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../entities/enrollment.entity';
import { Notification } from '../entities/notification.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { Zone } from '../entities/zone.entity';
import { AccountantModule } from '../accountant/accountant.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { ExpiryCheckerCron } from './notifications.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User, Enrollment, Student, Zone]),
    AccountantModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, ExpiryCheckerCron],
  exports: [NotificationsService],
})
export class NotificationsModule {}
