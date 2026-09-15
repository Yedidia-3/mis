import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { User } from '../../entities/user.entity';
import { AssessmentsService } from './assessments.service';
import {
  CreateAssessmentTypeDto, CreateSubjectDto, CreateTermDto,
  UpdateAssessmentTypeDto, UpdateSubjectDto, UpdateTermDto,
  CreateCatalogueEntryDto, UpdateCatalogueEntryDto, AssignPLevelDto,
} from './dto/config.dto';
import { CreateAssessmentDto, SaveScoresDto, UpdateAssessmentDto } from './dto/assessment.dto';

// Literal segments are declared before ':id' so that /assessments/terms is not
// captured as an assessment whose id is "terms".
@Controller('api/v1/academics/assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentsController {
  constructor(private assessmentsService: AssessmentsService) {}

  // ─── Course catalogue ─────────────────────────────────────────────────────────

  @Get('catalogue')
  @Roles('dean', 'principal', 'super_admin')
  listCatalogue() {
    return this.assessmentsService.listCatalogue();
  }

  @Post('catalogue')
  @Roles('dean')
  createCatalogueEntry(@Body() dto: CreateCatalogueEntryDto) {
    return this.assessmentsService.createCatalogueEntry(dto);
  }

  @Put('catalogue/:id')
  @Roles('dean')
  updateCatalogueEntry(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCatalogueEntryDto) {
    return this.assessmentsService.updateCatalogueEntry(id, dto);
  }

  @Delete('catalogue/:id')
  @Roles('dean')
  deleteCatalogueEntry(@Param('id', ParseIntPipe) id: number) {
    return this.assessmentsService.deleteCatalogueEntry(id);
  }

  @Post('catalogue/assign-p-level')
  @Roles('dean')
  assignPLevel(@Body() dto: AssignPLevelDto) {
    return this.assessmentsService.assignPLevel(dto);
  }

  // ─── Terms (dean configures, everyone reads) ─────────────────────────────────

  @Get('terms')
  @Roles('dean', 'principal', 'teacher', 'super_admin')
  listTerms(@Query('academic_year_id', ParseIntPipe) yearId: number) {
    return this.assessmentsService.listTerms(yearId);
  }

  @Post('terms')
  @Roles('dean')
  createTerm(@Body() dto: CreateTermDto) {
    return this.assessmentsService.createTerm(dto);
  }

  @Put('terms/:id')
  @Roles('dean')
  updateTerm(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTermDto) {
    return this.assessmentsService.updateTerm(id, dto);
  }

  // ─── Subjects ────────────────────────────────────────────────────────────────

  @Get('subjects')
  @Roles('dean', 'principal', 'teacher', 'super_admin')
  listSubjects(@Query('p_level_id', ParseIntPipe) pLevelId: number) {
    return this.assessmentsService.listSubjects(pLevelId);
  }

  @Post('subjects')
  @Roles('dean')
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.assessmentsService.createSubject(dto);
  }

  @Put('subjects/:id')
  @Roles('dean')
  updateSubject(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubjectDto) {
    return this.assessmentsService.updateSubject(id, dto);
  }

  @Delete('subjects/:id')
  @Roles('dean')
  deleteSubject(@Param('id', ParseIntPipe) id: number) {
    return this.assessmentsService.deleteSubject(id);
  }

  // ─── Assessment types and weights ────────────────────────────────────────────

  // Teachers read these because the recording form is built from them.
  @Get('types')
  @Roles('dean', 'principal', 'teacher', 'super_admin')
  listTypes(@Query('academic_year_id', ParseIntPipe) yearId: number) {
    return this.assessmentsService.listAssessmentTypes(yearId);
  }

  @Post('types')
  @Roles('dean')
  createType(@Body() dto: CreateAssessmentTypeDto) {
    return this.assessmentsService.createAssessmentType(dto);
  }

  @Put('types/:id')
  @Roles('dean')
  updateType(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAssessmentTypeDto) {
    return this.assessmentsService.updateAssessmentType(id, dto);
  }

  @Delete('types/:id')
  @Roles('dean')
  deleteType(@Param('id', ParseIntPipe) id: number) {
    return this.assessmentsService.deleteAssessmentType(id);
  }

  // ─── Teacher's own assessments ───────────────────────────────────────────────

  @Get('mine')
  @Roles('teacher')
  listMine(@CurrentUser() user: User) {
    return this.assessmentsService.listMyAssessments(user);
  }

  // ─── Supervisors' oversight list ─────────────────────────────────────────────

  @Get()
  @Roles('dean', 'principal', 'super_admin')
  listForSupervisors(
    @Query('class_id') classId?: string,
    @Query('term_id') termId?: string,
    @Query('subject_id') subjectId?: string,
  ) {
    return this.assessmentsService.listForSupervisors({
      class_id: classId ? +classId : undefined,
      term_id: termId ? +termId : undefined,
      subject_id: subjectId ? +subjectId : undefined,
    });
  }

  // ─── Recording ───────────────────────────────────────────────────────────────

  @Post()
  @Roles('teacher')
  create(@Body() dto: CreateAssessmentDto, @CurrentUser() user: User) {
    return this.assessmentsService.createAssessment(dto, user);
  }

  // Shared: a teacher sees their own, supervisors see submitted ones. The
  // service decides which, since the rule depends on the record, not the route.
  @Get(':id')
  @Roles('teacher', 'dean', 'principal', 'super_admin')
  getOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assessmentsService.getAssessment(id, user);
  }

  @Put(':id')
  @Roles('teacher')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() user: User,
  ) {
    return this.assessmentsService.updateAssessment(id, dto, user);
  }

  @Delete(':id')
  @Roles('teacher')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assessmentsService.deleteAssessment(id, user);
  }

  @Put(':id/scores')
  @Roles('teacher')
  saveScores(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveScoresDto,
    @CurrentUser() user: User,
  ) {
    return this.assessmentsService.saveScores(id, dto, user);
  }

  @Post(':id/submit')
  @Roles('teacher')
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assessmentsService.submitAssessment(id, user);
  }

  @Post(':id/reopen')
  @Roles('teacher')
  reopen(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assessmentsService.reopenAssessment(id, user);
  }
}
