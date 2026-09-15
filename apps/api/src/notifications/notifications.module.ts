import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../entities/enrollment.entity';
import { Notification } from '../entities/notification.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { Zone } from '../entities/zone.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { ExpiryCheckerCron } from './notifications.cron';
import { AccountantService } from '../accountant/accountant.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User, Enrollment, Student, Zone])],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, ExpiryCheckerCron, AccountantService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
