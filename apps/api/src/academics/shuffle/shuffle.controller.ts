import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { User } from '../../entities/user.entity';
import { ClassExportData, ExportService } from '../export.service';
import { RunShuffleDto } from './dto/run-shuffle.dto';
import { ShuffleService } from './shuffle.service';

@Controller('api/v1/academics/shuffle')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShuffleController {
  constructor(
    private shuffleService: ShuffleService,
    private exportService: ExportService,
  ) {}

  @Post('run')
  @Roles('dean')
  runShuffle(@Body() dto: RunShuffleDto, @CurrentUser() user: User) {
    return this.shuffleService.runShuffle(dto, user.id);
  }

  @Get(':sessionId/preview')
  @Roles('dean', 'principal')
  getPreview(@Param('sessionId') id: string) {
    return this.shuffleService.getPreview(+id);
  }

  @Put(':sessionId/adjust/:resultId')
  @Roles('dean')
  adjustStudent(
    @Param('sessionId') sessionId: string,
    @Param('resultId') resultId: string,
    @Body('new_class_id') newClassId: number,
  ) {
    return this.shuffleService.adjustStudent(+sessionId, +resultId, newClassId);
  }

  @Post(':sessionId/submit')
  @Roles('dean')
  submit(
    @Param('sessionId') sessionId: string,
    @Body('principal_id') principalId: number,
    @CurrentUser() user: User,
  ) {
    return this.shuffleService.submitForApproval(+sessionId, user.id, principalId);
  }

  @Post(':sessionId/approve')
  @Roles('principal')
  approve(
    @Param('sessionId') sessionId: string,
    @Body('dean_id') deanId: number,
    @CurrentUser() user: User,
  ) {
    return this.shuffleService.approve(+sessionId, user.id, deanId);
  }

  @Post(':sessionId/reject')
  @Roles('principal')
  reject(
    @Param('sessionId') sessionId: string,
    @Body('note') note: string,
    @Body('dean_id') deanId: number,
    @CurrentUser() user: User,
  ) {
    return this.shuffleService.reject(+sessionId, user.id, deanId, note);
  }

  @Post(':sessionId/distribute')
  @Roles('dean')
  distribute(
    @Param('sessionId') sessionId: string,
    @Body('senior_staff_id') seniorStaffId: number,
    @Body('accountant_id') accountantId: number,
    @Body('teacher_assignments') teacherAssignments: { class_id: number; teacher_id: number }[],
    @CurrentUser() user: User,
  ) {
    const targetId = seniorStaffId ?? accountantId;
    return this.shuffleService.distribute(+sessionId, user.id, targetId, teacherAssignments ?? []);
  }

  @Get('pending')
  @Roles('principal')
  getPending() {
    return this.shuffleService.getPendingApprovals();
  }

  // Export shuffle session class lists as .xlsx or .docx
  @Get(':sessionId/export')
  @Roles('dean', 'principal')
  async exportShufflePreview(
    @Param('sessionId') sessionId: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    if (format !== 'xlsx' && format !== 'docx') {
      throw new BadRequestException('format must be xlsx or docx');
    }
    const preview = await this.shuffleService.getPreview(+sessionId);
    const pLevelName = preview.session.p_level?.name ?? '';

    const exportData: ClassExportData[] = Object.entries(preview.grouped).map(
      ([label, students]) => ({
        className: label.replace(pLevelName, ''),
        pLevelName,
        students: (students as any[]).map((s) => ({
          name: s.name,
          rank: s.rank,
          marks_percentage: s.marks_percentage,
          former_class: s.former_class,
        })),
      }),
    );

    const filename = `${pLevelName}-shuffle-preview`;
    if (format === 'xlsx') {
      const buffer = await this.exportService.generateXlsx(exportData);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      });
      res.send(buffer);
    } else {
      const buffer = await this.exportService.generateDocx(exportData);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      });
      res.send(buffer);
    }
  }

  // Lists all shuffle sessions with their status (Dean Distribution + Principal overview)
  @Get('sessions')
  @Roles('dean', 'principal')
  getDeanSessions() {
    return this.shuffleService.getDeanSessions();
  }
}
