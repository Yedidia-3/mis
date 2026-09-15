import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { User } from '../../entities/user.entity';
import { GradesService } from './grades.service';

/**
 * Computed grades, as opposed to the raw marks under /assessments.
 *
 * Every route is read-only: grades are derived from submitted marks and are
 * never edited directly. Correcting a grade means correcting the marks it came
 * from, which keeps the audit trail intact.
 */
@Controller('api/v1/academics/grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradesController {
  constructor(private gradesService: GradesService) {}

  /** Whole class for one term, ranked — the practical day-to-day view. */
  @Get('classes/:classId')
  @Roles('teacher', 'dean', 'principal', 'super_admin')
  classSheet(
    @Param('classId', ParseIntPipe) classId: number,
    @Query('term_id', ParseIntPipe) termId: number,
    @CurrentUser() user: User,
  ) {
    return this.gradesService.getClassTermGrades(classId, termId, user);
  }

  /** One student's subject grades for a term, with their class position. */
  @Get('students/:studentId')
  @Roles('teacher', 'dean', 'principal', 'super_admin')
  studentTerm(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('term_id', ParseIntPipe) termId: number,
    @CurrentUser() user: User,
  ) {
    return this.gradesService.getStudentTermGrades(studentId, termId, user);
  }

  /** All three terms together — the annual result, once the year is complete. */
  @Get('students/:studentId/year')
  @Roles('teacher', 'dean', 'principal', 'super_admin')
  studentYear(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('academic_year_id', ParseIntPipe) academicYearId: number,
    @CurrentUser() user: User,
  ) {
    return this.gradesService.getStudentYearPerformance(studentId, academicYearId, user);
  }
}
