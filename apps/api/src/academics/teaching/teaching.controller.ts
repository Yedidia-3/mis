import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { User } from '../../entities/user.entity';
import { TeachingService } from './teaching.service';
import { AssignBatchDto, AssignSubjectsDto, TeachingYearOptionalQueryDto, TeachingYearQueryDto } from './dto/teaching.dto';

@Controller('api/v1/academics/teaching')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachingController {
  constructor(private teachingService: TeachingService) {}

  /** A teacher's own subjects, classes and workload. */
  @Get('mine')
  @Roles('teacher')
  mine(@CurrentUser() user: User) {
    return this.teachingService.getTeacherAssignments(user.id);
  }

  /** Every teacher's load — including those with nothing assigned yet. */
  @Get('loads')
  @Roles('dean', 'principal', 'super_admin')
  loads(@Query() query: TeachingYearQueryDto) {
    return this.teachingService.listTeacherLoads(query.academic_year_id);
  }

  /** Per-class subject coverage for the year — gaps are subjects with no teacher. */
  @Get('coverage')
  @Roles('dean', 'principal', 'super_admin')
  coverage(@Query() query: TeachingYearQueryDto) {
    return this.teachingService.classCoverage(query.academic_year_id);
  }

  /** Teachers plus class/subject board used by the assignment screen. */
  @Get('board')
  @Roles('dean', 'principal', 'super_admin')
  board(@Query() query: TeachingYearQueryDto) {
    return this.teachingService.assignmentBoard(query.academic_year_id);
  }

  @Get('teachers/:teacherId')
  @Roles('dean', 'principal', 'super_admin')
  forTeacher(
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Query() query: TeachingYearOptionalQueryDto,
  ) {
    return this.teachingService.getTeacherAssignments(teacherId, query.academic_year_id);
  }

  /** Subjects a teacher may record marks for in a class. */
  @Get('classes/:classId/my-subjects')
  @Roles('teacher')
  mySubjectsInClass(
    @Param('classId', ParseIntPipe) classId: number,
    @CurrentUser() user: User,
  ) {
    return this.teachingService.subjectsFor(user.id, classId);
  }

  @Put('assign')
  @Roles('dean')
  assign(@Body() dto: AssignSubjectsDto) {
    return this.teachingService.assignSubjects(dto.teacher_id, dto.class_id, dto.subject_ids);
  }

  /** Assign one teacher across several classes (and levels) in one save. */
  @Put('assign-batch')
  @Roles('dean')
  assignBatch(@Body() dto: AssignBatchDto) {
    return this.teachingService.assignBatch(dto.teacher_id, dto.assignments);
  }

  /**
   * Regenerate the automatic assignments for a class.
   *
   * Called after the dean changes a class teacher at a level where one teacher
   * takes every subject.
   */
  @Post('classes/:classId/sync')
  @Roles('dean')
  sync(@Param('classId', ParseIntPipe) classId: number) {
    return this.teachingService.syncClassTeacherAssignments(classId);
  }

  @Delete(':id')
  @Roles('dean')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.teachingService.removeAssignment(id);
  }
}
