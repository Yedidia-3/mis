import {
    BadRequestException, Body, Controller, Delete, Get, Param, Post, Put,
    Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../entities/user.entity';
import { AcademicsService } from './academics.service';
import { ClassExportData, ExportService } from './export.service';

@Controller('api/v1/academics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicsController {
  constructor(
    private academicsService: AcademicsService,
    private exportService: ExportService,
  ) {}

  // Academic Years (shared — accessible to all roles)
  @Get('academic-years')
  @Roles('dean', 'principal', 'teacher', 'accountant', 'super_admin')
  listAcademicYears() {
    return this.academicsService.listAcademicYears();
  }

  // P-Levels
  @Get('p-levels')
  @Roles('dean', 'principal', 'teacher', 'accountant')
  listPLevels(@Query('academic_year_id') yearId: string) {
    return this.academicsService.listPLevels(+yearId);
  }

  @Get('p-levels/:id')
  @Roles('dean', 'principal', 'teacher', 'accountant')
  getPLevel(@Param('id') id: string) {
    return this.academicsService.getPLevel(+id);
  }

  @Post('p-levels')
  @Roles('dean')
  createPLevel(@Body('name') name: string, @Body('academic_year_id') yearId: number) {
    return this.academicsService.createPLevel(name, yearId);
  }

  @Delete('p-levels/:id')
  @Roles('dean')
  deletePLevel(@Param('id') id: string) {
    return this.academicsService.deletePLevel(+id);
  }

  // Classes
  @Get('p-levels/:id/classes')
  @Roles('dean', 'principal', 'teacher', 'accountant')
  listClasses(@Param('id') id: string) {
    return this.academicsService.listClasses(+id);
  }

  @Get('p-levels/:id/student-count')
  @Roles('dean', 'principal', 'teacher', 'accountant')
  getStudentCount(
    @Param('id') id: string,
    @Query('academic_year_id') yearId: string,
  ) {
    return this.academicsService.getStudentCountForPLevel(+id, +yearId);
  }

  @Post('classes')
  @Roles('dean')
  createClass(@Body('name') name: string, @Body('p_level_id') pLevelId: number) {
    return this.academicsService.createClass(name, pLevelId);
  }

  @Delete('classes/:id')
  @Roles('dean', 'accountant', 'super_admin')
  deleteClass(@Param('id') id: string) {
    return this.academicsService.deleteClass(+id);
  }

  @Put('classes/:id/assign-teacher')
  @Roles('dean')
  assignTeacher(@Param('id') id: string, @Body('teacher_id') teacherId: number) {
    return this.academicsService.assignTeacher(+id, teacherId);
  }

  // Students
  @Get('students')
  @Roles('dean', 'principal', 'teacher', 'accountant', 'super_admin')
  listStudents(
    @Query('academic_year_id') yearId?: string,
    @Query('p_level_id') pLevelId?: string,
    @Query('class_id') classId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.academicsService.listStudents({
      academicYearId: yearId ? +yearId : undefined,
      pLevelId: pLevelId ? +pLevelId : undefined,
      classId: classId ? +classId : undefined,
      search,
      status,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Post('students/import')
  @Roles('dean', 'principal', 'teacher', 'accountant', 'super_admin')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importStudents(
    @UploadedFile() file: Express.Multer.File,
    @Query('academic_year_id') yearId?: string,
    @Query('p_level_id') pLevelId?: string,
    @Query('class_id') classId?: string,
    @Query('dry_run') dryRun?: string,
    @CurrentUser() user?: User,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.academicsService.importStudentsUniversal(
      file.buffer,
      file.originalname || 'import.xlsx',
      {
        academicYearId: yearId ? +yearId : undefined,
        pLevelId: pLevelId ? +pLevelId : undefined,
        classId: classId ? +classId : undefined,
        dryRun: dryRun === 'true',
      },
      user,
    );
  }

  @Post('students/bulk-delete')
  @Roles('dean', 'principal', 'teacher', 'accountant', 'super_admin')
  deleteStudentsBulk(@Body('ids') ids: number[]) {
    return this.academicsService.deleteStudentsBulk(ids ?? []);
  }

  @Post('students')
  @Roles('dean', 'principal', 'teacher', 'accountant', 'super_admin')
  createStudent(@Body() body: any, @CurrentUser() user: User) {
    return this.academicsService.createStudent(body ?? {}, user);
  }

  @Get('students/:id')
  @Roles('dean', 'principal', 'teacher', 'accountant', 'super_admin')
  getStudent(@Param('id') id: string) {
    return this.academicsService.getStudent(+id);
  }

  @Post('students/:id/approve')
  @Roles('dean', 'principal', 'super_admin')
  approveStudent(@Param('id') id: string, @CurrentUser() user: User) {
    return this.academicsService.approveStudent(+id, user);
  }

  @Post('students/:id/reject')
  @Roles('dean', 'principal', 'super_admin')
  rejectStudent(@Param('id') id: string, @CurrentUser() user: User) {
    return this.academicsService.rejectStudent(+id, user);
  }

  @Post('students/bulk-approve')
  @Roles('dean', 'principal', 'super_admin')
  approveStudentsBulk(@Body('ids') ids: number[], @CurrentUser() user: User) {
    return this.academicsService.approveStudentsBulk(ids ?? [], user);
  }

  @Post('students/bulk-reject')
  @Roles('dean', 'principal', 'super_admin')
  rejectStudentsBulk(@Body('ids') ids: number[], @CurrentUser() user: User) {
    return this.academicsService.rejectStudentsBulk(ids ?? [], user);
  }

  @Post('classes/:id/approve-imports')
  @Roles('dean', 'principal', 'super_admin')
  approveClassImports(@Param('id') id: string, @CurrentUser() user: User) {
    return this.academicsService.approveClassImports(+id, user);
  }

  @Post('classes/:id/reject-imports')
  @Roles('dean', 'principal', 'super_admin')
  rejectClassImports(@Param('id') id: string, @CurrentUser() user: User) {
    return this.academicsService.rejectClassImports(+id, user);
  }

  @Get('classes/:id/students')
  @Roles('dean', 'principal', 'teacher', 'accountant')
  getStudents(@Param('id') id: string, @CurrentUser() user: User) {
    return this.academicsService.getClassStudentsForUser(+id, user);
  }

  @Post('classes/:id/students')
  @Roles('dean', 'accountant', 'teacher')
  addStudents(
    @Param('id') id: string,
    @Body('students') students: { name: string }[],
    @CurrentUser() user: User,
  ) {
    return this.academicsService.addStudentsToClassForUser(+id, students ?? [], user);
  }

  @Put('students/:id')
  @Roles('dean', 'principal', 'teacher', 'accountant', 'super_admin')
  updateStudent(
    @Param('id') id: string,
    @Body() body: { name?: string; student_id_number?: string; current_class_id?: number; former_class?: string; rank?: number | string; marks_percentage?: number | string; status?: string },
    @CurrentUser() user: User,
  ) {
    return this.academicsService.updateStudentForUser(+id, body ?? {}, user);
  }

  @Delete('students/:id')
  @Roles('dean', 'principal', 'teacher', 'accountant', 'super_admin')
  removeStudentFromClass(@Param('id') id: string, @CurrentUser() user: User) {
    if (user.role === 'teacher') {
      return this.academicsService.removeStudentFromClassForUser(+id, user);
    }
    return this.academicsService.deleteStudent(+id);
  }

  @Put('students/:id/move')
  @Roles('dean')
  moveStudent(@Param('id') id: string, @Body('new_class_id') newClassId: number) {
    return this.academicsService.moveStudent(+id, newClassId);
  }

  // Excel import (legacy dean import)
  @Post('p-levels/:id/import')
  @Roles('dean', 'principal', 'teacher', 'accountant', 'super_admin')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importExcel(
    @Param('id') id: string,
    @Query('academic_year_id') yearId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user?: User,
  ) {
    if (!file) throw new Error('No file uploaded');
    return this.academicsService.importStudentsUniversal(
      file.buffer,
      file.originalname || 'import.xlsx',
      {
        academicYearId: yearId ? +yearId : undefined,
        pLevelId: +id,
      },
      user,
    );
  }

  // Teacher portal
  @Get('teacher/classes')
  @Roles('teacher')
  getTeacherClasses(@CurrentUser() user: User) {
    return this.academicsService.getTeacherClasses(user.id);
  }

  @Get('teacher/today-summary')
  @Roles('teacher')
  getTeacherTodaySummary(@CurrentUser() user: User) {
    return this.academicsService.getTeacherTodaySummary(user.id);
  }

  // Attendance
  @Get('classes/:id/attendance')
  @Roles('teacher', 'dean', 'principal')
  getAttendance(@Param('id') id: string, @Query('date') date: string, @CurrentUser() user: User) {
    const day = date || new Date().toISOString().split('T')[0];
    return this.academicsService.getClassAttendanceForUser(+id, day, user);
  }

  @Post('classes/:id/attendance')
  @Roles('teacher')
  saveAttendance(
    @Param('id') id: string,
    @Body('date') date: string,
    @Body('records') records: { student_id: number; status: 'present' | 'absent' | 'late' }[],
    @CurrentUser() user: User,
  ) {
    return this.academicsService.saveClassAttendanceForUser(+id, date, records, user);
  }

  @Post('classes/:id/attendance/reset')
  @Roles('teacher')
  resetAttendance(
    @Param('id') id: string,
    @Body('date') date: string,
    @CurrentUser() user: User,
  ) {
    return this.academicsService.resetClassAttendanceForUser(+id, date, user);
  }

  @Get('teacher/attendance-history')
  @Roles('teacher')
  getAttendanceHistory(@CurrentUser() user: User) {
    return this.academicsService.getTeacherAttendanceHistory(user.id);
  }

  // Distribution Module
  @Get('distribution/summary')
  @Roles('dean', 'principal', 'super_admin', 'accountant')
  getDistributionSummary(@Query('academic_year_id') yearId?: string) {
    return this.academicsService.getDistributionSummary(yearId ? +yearId : undefined);
  }

  @Post('distribution/distribute-class')
  @Roles('dean', 'principal', 'super_admin')
  distributeClass(@Body() body: { class_id: number; teacher_id?: number }, @CurrentUser() user: User) {
    return this.academicsService.distributeClass(body.class_id, body, user);
  }

  @Post('distribution/distribute-plevel')
  @Roles('dean', 'principal', 'super_admin')
  distributePLevel(
    @Body() body: { p_level_id: number; teacher_assignments?: Array<{ class_id: number; teacher_id: number }> },
    @CurrentUser() user: User,
  ) {
    return this.academicsService.distributePLevel(body.p_level_id, body.teacher_assignments ?? [], user);
  }

  // Accountant portal
  @Get('all-classes')
  @Roles('accountant')
  getAllClasses(@Query('academic_year_id') yearId?: string) {
    return this.academicsService.getAllDistributedClasses(yearId ? +yearId : undefined);
  }

  // Export class list as .xlsx or .docx
  @Get('classes/:id/export')
  @Roles('dean', 'principal', 'teacher', 'accountant')
  async exportClassList(
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() res: Response,
    @CurrentUser() user: User,
  ) {
    if (format !== 'xlsx' && format !== 'docx') {
      throw new BadRequestException('format must be xlsx or docx');
    }
    const classInfo = await this.academicsService.getClassWithPLevelForUser(+id, user);
    const students = await this.academicsService.getClassStudentsForUser(+id, user);
    const data: ClassExportData = {
      className: classInfo.name,
      pLevelName: classInfo.pLevelName,
      students,
    };
    const filename = `${data.pLevelName}${data.className}-class-list`;
    if (format === 'xlsx') {
      const buffer = await this.exportService.generateXlsx([data]);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      });
      res.send(buffer);
    } else {
      const buffer = await this.exportService.generateDocx([data]);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      });
      res.send(buffer);
    }
  }
}
