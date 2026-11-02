import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { User } from '../../entities/user.entity';
import { BandQueryDto, GenerateReportsDto, ReportQueryDto, SaveSubjectReportSettingsDto } from './dto/records.dto';
import { RecordsService } from './records.service';
import { ReportsService } from './reports.service';
import { SchoolBand } from './school-band';

@Controller('api/v1/academics/records')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('dean')
export class RecordsController {
  constructor(private records: RecordsService) {}

  @Get('sections')
  sections() {
    return this.records.sections();
  }

  @Get('sections/:band/teachers')
  sectionTeachers(@Param() params: BandQueryDto) {
    return this.records.sectionTeachers(params.band as SchoolBand);
  }

  @Get('teachers/:teacherId/assessments')
  teacherAssessments(@Param('teacherId', ParseIntPipe) teacherId: number, @Query() query: BandQueryDto) {
    return this.records.teacherAssessments(teacherId, query.band);
  }
}

@Controller('api/v1/academics/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('dean')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('classes')
  classes(@Query() query: ReportQueryDto) {
    return this.reports.listClasses(query.kind, query.term_id);
  }

  @Get('classes/:classId/preview')
  preview(@Param('classId', ParseIntPipe) classId: number, @Query() query: ReportQueryDto) {
    return this.reports.preview(classId, query.kind, query.term_id);
  }

  @Get('classes/:classId/cards')
  cards(@Param('classId', ParseIntPipe) classId: number, @Query() query: ReportQueryDto) {
    return this.reports.cards(classId, query.kind, query.term_id);
  }

  @Post('generate')
  generate(@Body() dto: GenerateReportsDto, @CurrentUser() user: User) {
    return this.reports.generate(dto, user);
  }

  @Get('levels/:pLevelId/subjects')
  levelSubjects(@Param('pLevelId', ParseIntPipe) pLevelId: number) {
    return this.reports.levelSubjects(pLevelId);
  }

  @Put('levels/:pLevelId/subjects')
  saveLevelSubjects(@Param('pLevelId', ParseIntPipe) pLevelId: number, @Body() dto: SaveSubjectReportSettingsDto) {
    return this.reports.saveLevelSubjects(pLevelId, dto);
  }
}
