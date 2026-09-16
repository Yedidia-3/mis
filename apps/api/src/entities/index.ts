import { AcademicYear } from './academic-year.entity';
import { AssessmentScore } from './assessment-score.entity';
import { AssessmentType } from './assessment-type.entity';
import { Assessment } from './assessment.entity';
import { AttendanceSession } from './attendance-session.entity';
import { Attendance } from './attendance.entity';
import { AuditLog } from './audit-log.entity';
import { Class } from './class.entity';
import { CourseCatalogue } from './course-catalogue.entity';
import { Enrollment } from './enrollment.entity';
import { Notification } from './notification.entity';
import { PLevel } from './p-level.entity';
import { ShuffleResult } from './shuffle-result.entity';
import { ShuffleSession } from './shuffle-session.entity';
import { Student } from './student.entity';
import { Subject } from './subject.entity';
import { TeachingAssignment } from './teaching-assignment.entity';
import { Term } from './term.entity';
import { User } from './user.entity';
import { Zone } from './zone.entity';

/**
 * Single source of truth for the entity list.
 *
 * Every DataSource in the project (app.module, data-source, seed, reset-admin)
 * imports this. Registering an entity in one place and forgetting another is
 * how `reset-admin` ended up connecting with only 10 of the 15 entities.
 */
export const entities = [
  AcademicYear,
  Assessment,
  AssessmentScore,
  AssessmentType,
  Attendance,
  AttendanceSession,
  AuditLog,
  Class,
  CourseCatalogue,
  Enrollment,
  Notification,
  PLevel,
  ShuffleResult,
  ShuffleSession,
  Student,
  Subject,
  TeachingAssignment,
  Term,
  User,
  Zone,
];

export {
    AcademicYear,
    Assessment,
    AssessmentScore,
    AssessmentType,
    Attendance,
    AttendanceSession,
    AuditLog,
    Class,
    CourseCatalogue,
    Enrollment,
    Notification,
    PLevel,
    ShuffleResult,
    ShuffleSession,
    Student,
    Subject,
    TeachingAssignment,
    Term, User,
    Zone
};
