import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsInt, ValidateNested } from 'class-validator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { User } from '../../entities/user.entity';
import { TeachingService } from './teaching.service';

export class AssignSubjectsDto {
  @IsInt()
  teacher_id: number;

  @IsInt()
  class_id: number;

  @IsArray()
  @IsInt({ each: true })
  subject_ids: number[];
}

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
  loads(@Query('academic_year_id', ParseIntPipe) yearId: number) {
    return this.teachingService.listTeacherLoads(yearId);
  }

  @Get('teachers/:teacherId')
  @Roles('dean', 'principal', 'super_admin')
  forTeacher(@Param('teacherId', ParseIntPipe) teacherId: number) {
    return this.teachingService.getTeacherAssignments(teacherId);
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
