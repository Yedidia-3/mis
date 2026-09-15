import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicYear } from '../entities/academic-year.entity';
import { ShuffleSession } from '../entities/shuffle-session.entity';
import { PLevel } from '../entities/p-level.entity';
import { User } from '../entities/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, AcademicYear, ShuffleSession, PLevel])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
