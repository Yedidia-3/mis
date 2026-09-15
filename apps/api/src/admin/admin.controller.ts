import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  @Roles('super_admin')
  listUsers() { return this.adminService.listUsers(); }

  @Post('users')
  @Roles('super_admin')
  createUser(@Body() dto: CreateUserDto) { return this.adminService.createUser(dto); }

  @Put('users/:id')
  @Roles('super_admin')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(+id, dto);
  }

  @Delete('users/:id')
  @Roles('super_admin')
  deleteUser(@Param('id') id: string) { return this.adminService.deleteUser(+id); }

  @Post('users/:id/deactivate')
  @Roles('super_admin')
  deactivateUser(@Param('id') id: string) { return this.adminService.deactivateUser(+id); }

  @Post('users/:id/reset-password')
  @Roles('super_admin')
  resetPassword(@Param('id') id: string) { return this.adminService.resetPassword(+id); }

  /** Staff list — accessible to dean and principal for assigning teachers/picking reviewers */
  @Get('staff')
  @Roles('super_admin', 'dean', 'principal')
  listStaff(@Query('role') role?: string) { return this.adminService.listStaff(role); }

  @Get('academic-years')
  @Roles('super_admin')
  listAcademicYears() { return this.adminService.listAcademicYears(); }

  @Post('academic-years')
  @Roles('super_admin')
  createAcademicYear(@Body('name') name: string) { return this.adminService.createAcademicYear(name); }

  @Post('academic-years/:id/archive')
  @Roles('super_admin')
  archiveAcademicYear(@Param('id') id: string) { return this.adminService.archiveAcademicYear(+id); }

  // Deletion workflow — requested by Super Admin, approved by Principal
  @Post('academic-years/:id/request-deletion')
  @Roles('super_admin')
  requestYearDeletion(@Param('id') id: string) { return this.adminService.requestYearDeletion(+id); }

  @Get('academic-years/pending-deletions')
  @Roles('principal', 'super_admin')
  pendingYearDeletions() { return this.adminService.pendingYearDeletions(); }

  @Post('academic-years/:id/approve-deletion')
  @Roles('principal')
  approveYearDeletion(@Param('id') id: string) { return this.adminService.approveYearDeletion(+id); }

  @Post('academic-years/:id/reject-deletion')
  @Roles('principal')
  rejectYearDeletion(@Param('id') id: string) { return this.adminService.rejectYearDeletion(+id); }

  @Get('audit-log')
  @Roles('super_admin')
  getAuditLog() { return this.adminService.getAuditLog(); }
}
