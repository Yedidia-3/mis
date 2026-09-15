import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from '../entities/enrollment.entity';
import { Student } from '../entities/student.entity';
import { Zone } from '../entities/zone.entity';
import { AccountantController } from './accountant.controller';
import { AccountantService } from './accountant.service';

@Module({
  imports: [TypeOrmModule.forFeature([Zone, Enrollment, Student])],
  controllers: [AccountantController],
  providers: [AccountantService],
  exports: [AccountantService],
})
export class AccountantModule {}
