import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicYear } from '../entities/academic-year.entity';
import { AssessmentScore } from '../entities/assessment-score.entity';
import { AssessmentType } from '../entities/assessment-type.entity';
import { Assessment } from '../entities/assessment.entity';
import { AttendanceSession } from '../entities/attendance-session.entity';
import { Attendance } from '../entities/attendance.entity';
import { Class } from '../entities/class.entity';
import { CourseCatalogue } from '../entities/course-catalogue.entity';
import { PLevel } from '../entities/p-level.entity';
import { ShuffleResult } from '../entities/shuffle-result.entity';
import { ShuffleSession } from '../entities/shuffle-session.entity';
import { Student } from '../entities/student.entity';
import { Subject } from '../entities/subject.entity';
import { TeachingAssignment } from '../entities/teaching-assignment.entity';
import { Term } from '../entities/term.entity';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcademicsController } from './academics.controller';
import { AcademicsService } from './academics.service';
import { AssessmentsController } from './assessments/assessments.controller';
import { AssessmentsService } from './assessments/assessments.service';
import { GradesController } from './assessments/grades.controller';
import { GradesService } from './assessments/grades.service';
import { ExportService } from './export.service';
import { ShuffleController } from './shuffle/shuffle.controller';
import { ShuffleService } from './shuffle/shuffle.service';
import { TeachingController } from './teaching/teaching.controller';
import { TeachingService } from './teaching/teaching.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PLevel, Class, Student, ShuffleSession, ShuffleResult, AcademicYear,
      Attendance, AttendanceSession,
      Term, Subject, AssessmentType, Assessment, AssessmentScore,
      TeachingAssignment, User, CourseCatalogue,
    ]),
    NotificationsModule,
  ],
  controllers: [
    AcademicsController, ShuffleController,
    AssessmentsController, GradesController, TeachingController,
  ],
  providers: [
    AcademicsService, ExportService, ShuffleService,
    AssessmentsService, GradesService, TeachingService,
  ],
  exports: [AcademicsService, ExportService, AssessmentsService, GradesService, TeachingService],
})
export class AcademicsModule {}
