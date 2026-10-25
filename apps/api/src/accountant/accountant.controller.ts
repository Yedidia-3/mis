import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../entities/user.entity';
import { AccountantService } from './accountant.service';
import { AcceptRosterDto } from './dto/accept-roster.dto';
import { SetFeedingPricesDto } from './dto/set-feeding-prices.dto';
import { BulkEnrollDto } from './enrollments/dto/bulk-enroll.dto';
import { BulkRemoveEnrollmentsDto } from './enrollments/dto/bulk-remove.dto';
import { CreateEnrollmentDto } from './enrollments/dto/create-enrollment.dto';
import { CreateZoneDto } from './zones/dto/create-zone.dto';

@Controller('api/v1/accountant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('accountant')
export class AccountantController {
  constructor(private accountantService: AccountantService) {}

  // Meal prices — set once, then every B/L tick loads them.
  @Get('feeding-prices')
  getFeedingPrices() { return this.accountantService.getFeedingPrices(); }

  @Put('feeding-prices')
  setFeedingPrices(@Body() dto: SetFeedingPricesDto) {
    return this.accountantService.setFeedingPrices(dto.breakfast, dto.lunch);
  }

  // Zones
  @Get('zones')
  listZones() { return this.accountantService.listZones(); }

  @Post('zones')
  createZone(@Body() dto: CreateZoneDto) { return this.accountantService.createZone(dto); }

  @Put('zones/:id')
  updateZone(@Param('id') id: string, @Body() dto: Partial<CreateZoneDto>) {
    return this.accountantService.updateZone(+id, dto);
  }

  @Delete('zones/:id')
  deleteZone(@Param('id') id: string) { return this.accountantService.deleteZone(+id); }

  // Enrollments
  @Get('enrollments')
  listEnrollments(@Query('type') type?: 'feeding' | 'transport') {
    return this.accountantService.listEnrollments(type);
  }

  @Post('enrollments')
  createEnrollment(@Body() dto: CreateEnrollmentDto) { return this.accountantService.createEnrollment(dto); }

  @Post('enrollments/bulk')
  bulkEnroll(@Body() dto: BulkEnrollDto, @CurrentUser() user: User) {
    return this.accountantService.bulkEnroll(dto, user.id);
  }

  @Post('enrollments/bulk-remove')
  bulkRemove(@Body() dto: BulkRemoveEnrollmentsDto) {
    return this.accountantService.archiveEnrollments(dto.ids);
  }

  @Get('roster')
  listRoster(@CurrentUser() user: User) {
    return this.accountantService.listRoster(user.id);
  }

  @Post('roster/accept')
  acceptRoster(@CurrentUser() user: User, @Body() dto: AcceptRosterDto) {
    return this.accountantService.acceptRoster(user.id, dto?.notification_id);
  }

  @Delete('enrollments/by-student/:studentId')
  waiveByStudent(
    @Param('studentId') studentId: string,
    @Query('type') type: 'feeding' | 'transport',
  ) {
    return this.accountantService.waiveByStudent(+studentId, type);
  }

  @Put('enrollments/:id')
  updateEnrollment(@Param('id') id: string, @Body() dto: Partial<CreateEnrollmentDto>) {
    return this.accountantService.updateEnrollment(+id, dto);
  }

  @Put('enrollments/:id/payments')
  updatePayments(@Param('id') id: string, @Body('payments') payments: Record<string, any>) {
    return this.accountantService.updatePayments(+id, payments);
  }

  @Put('enrollments/:id/zone')
  setZone(@Param('id') id: string, @Body('zone_id') zoneId: number | null) {
    return this.accountantService.setZone(+id, zoneId ?? null);
  }

  @Delete('enrollments/:id')
  archiveEnrollment(@Param('id') id: string) { return this.accountantService.archiveEnrollment(+id); }

  @Get('enrollments/expiring')
  getExpiring(@Query('days') days?: string) {
    return this.accountantService.getExpiringEnrollments(days ? +days : 3);
  }
}
