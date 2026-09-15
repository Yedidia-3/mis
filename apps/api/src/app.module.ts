import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from './entities';
import { buildDbConnection, shouldSynchronize } from './database/db-config';
import { AcademicsModule } from './academics/academics.module';
import { AccountantModule } from './accountant/accountant.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      // ConfigModule.forRoot populates process.env from .env, so the shared
      // helpers in database/db-config read the same values the CLI scripts do.
      useFactory: () => ({
        type: 'postgres' as const,
        ...buildDbConnection(),
        entities,
        migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
        // Apply pending migrations on boot. Handy on Railway/Render where there
        // is no shell step; leave unset to run them deliberately instead.
        migrationsRun: process.env.RUN_MIGRATIONS === 'true',
        retryAttempts: 10,
        retryDelay: 5000,
        synchronize: shouldSynchronize(),
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    AuditModule,
    AuthModule,
    AdminModule,
    AcademicsModule,
    AccountantModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
