import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Enrollment } from '../entities/enrollment.entity';
import { Zone } from '../entities/zone.entity';
import { Student } from '../entities/student.entity';
import { BulkEnrollDto } from './enrollments/dto/bulk-enroll.dto';
import { CreateEnrollmentDto } from './enrollments/dto/create-enrollment.dto';
import { CreateZoneDto } from './zones/dto/create-zone.dto';

@Injectable()
export class AccountantService implements OnModuleInit {
  constructor(
    @InjectRepository(Zone) private zoneRepo: Repository<Zone>,
    @InjectRepository(Enrollment) private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
  ) {}

  async onModuleInit() {
    try {
      // 1. Clean up any duplicate active enrollments (keep latest)
      await this.enrollmentRepo.query(`
        UPDATE enrollments
        SET status = 'archived'
        WHERE id NOT IN (
          SELECT MAX(id)
          FROM enrollments
          WHERE status = 'active'
          GROUP BY student_id, type
        ) AND status = 'active'
      `);

      // 2. Enforce database-level unique constraint on (student_id, type) where status = 'active'
      await this.enrollmentRepo.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_student_enrollment 
        ON enrollments (student_id, type) 
        WHERE status = 'active'
      `);
    } catch {
      // Index might already exist
    }
  }

  // ─── Active-year helper ───────────────────────────────────────────────────
  // Everything the accountant sees is scoped to the active academic year, so
  // starting a new year cleans enrollments and zones automatically.
  private async activeYearId(): Promise<number | null> {
    const r = await this.zoneRepo.query(
      `SELECT id FROM academic_years WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`,
    );
    return r[0]?.id ?? null;
  }

  // ─── Zones ──────────────────────────────────────────────────────────────────

  async listZones() {
    const yid = await this.activeYearId();
    return this.zoneRepo.find({
      where: { status: 'active', academic_year_id: yid ?? -1 },
      order: { name: 'ASC' },
    });
  }

  async createZone(dto: CreateZoneDto) {
    const yid = await this.activeYearId();
    const cleanName = dto.name.trim();
    const existing = await this.zoneRepo.findOne({
      where: { name: cleanName, status: 'active', academic_year_id: yid ?? undefined },
    });
    if (existing) {
      throw new BadRequestException(`A zone named "${cleanName}" already exists.`);
    }
    const zone = this.zoneRepo.create({ ...dto, name: cleanName, academic_year_id: yid ?? null });
    return this.zoneRepo.save(zone);
  }

  async updateZone(id: number, dto: Partial<CreateZoneDto>) {
    const zone = await this.zoneRepo.findOne({ where: { id } });
    if (!zone) throw new NotFoundException('Zone not found');
    Object.assign(zone, dto);
    return this.zoneRepo.save(zone);
  }

  async deleteZone(id: number) {
    const zone = await this.zoneRepo.findOne({ where: { id } });
    if (!zone) throw new NotFoundException('Zone not found');
    const inUse = await this.enrollmentRepo.count({ where: { zone_id: id, status: 'active' } });
    if (inUse > 0) throw new BadRequestException(`Zone is assigned to ${inUse} active enrollment(s). Reassign first.`);
    zone.status = 'inactive';
    await this.zoneRepo.save(zone);
    return { message: 'Zone removed' };
  }

  // ─── Enrollments ─────────────────────────────────────────────────────────────

  // Shared raw query — nested TypeORM relations load unreliably on this schema.
  private async rawEnrollments(typeClause = '', params: any[] = []) {
    return this.enrollmentRepo.query(
      `SELECT e.id, e.student_id, e.type, e.meal_type, e.zone_id, e.payments,
              e.payment_date::text  AS payment_date,
              e.duration_days,
              e.expiry_date::text   AS expiry_date,
              e.status,
              s.name AS student_name,
              c.id   AS class_id,   c.name AS class_name,
              pl.id  AS p_level_id, pl.name AS p_level_name,
              z.id   AS zone_pk,    z.name AS zone_name, z.price AS zone_price
       FROM enrollments e
       JOIN students s        ON s.id  = e.student_id
       LEFT JOIN classes c    ON c.id  = s.current_class_id
       LEFT JOIN p_levels pl  ON pl.id = c.p_level_id
       LEFT JOIN zones z      ON z.id  = e.zone_id
       WHERE e.status = 'active' ${typeClause}
         AND s.academic_year_id = (SELECT id FROM academic_years WHERE status = 'active' ORDER BY created_at DESC LIMIT 1)
       ORDER BY e.created_at DESC`,
      params,
    );
  }

  async listEnrollments(type?: 'feeding' | 'transport') {
    const params: any[] = [];
    let typeClause = '';
    if (type) { params.push(type); typeClause = `AND e.type = $${params.length}`; }
    const rows = await this.rawEnrollments(typeClause, params);
    return rows.map(this.mapEnrollmentRow);
  }

  // Human label for a payment cell key. Feeding: "1B"->"Month 1 Breakfast".
  // Transport: "1"->"Month 1".
  private cellLabel(type: string, key: string): string {
    const month = key.replace(/[BL]$/, '');
    if (type === 'feeding') {
      const meal = key.endsWith('B') ? 'Breakfast' : key.endsWith('L') ? 'Lunch' : '';
      return `Month ${month} ${meal}`.trim();
    }
    return `Month ${month} Transport`;
  }

  private mapEnrollmentRow = (r: any) => ({
    id: r.id,
    student_id: r.student_id,
    type: r.type,
    meal_type: r.meal_type,
    zone_id: r.zone_id,
    payments: r.payments ?? {},
    payment_date: r.payment_date,
    duration_days: r.duration_days,
    expiry_date: r.expiry_date,
    status: r.status,
    student: {
      id: r.student_id,
      name: r.student_name,
      current_class: r.class_id
        ? {
            id: r.class_id,
            name: r.class_name,
            p_level: r.p_level_id ? { id: r.p_level_id, name: r.p_level_name } : null,
          }
        : null,
    },
    zone: r.zone_pk ? { id: r.zone_pk, name: r.zone_name, price: Number(r.zone_price) } : null,
  });

  async createEnrollment(dto: CreateEnrollmentDto) {
    const student = await this.studentRepo.findOne({ where: { id: dto.student_id } });
    if (!student) throw new NotFoundException('Student not found');

    const existing = await this.enrollmentRepo.findOne({
      where: { student_id: dto.student_id, type: dto.type, status: 'active' },
    });
    if (existing) {
      throw new BadRequestException(`Student "${student.name}" is already actively enrolled in ${dto.type}.`);
    }

    // Calculate expiry date
    const paymentDate = new Date(dto.payment_date);
    const expiryDate = new Date(paymentDate);
    expiryDate.setDate(expiryDate.getDate() + dto.duration_days);

    const enrollment = this.enrollmentRepo.create({
      ...dto,
      expiry_date: expiryDate.toISOString().split('T')[0],
    });
    return this.enrollmentRepo.save(enrollment);
  }

  async updateEnrollment(id: number, dto: Partial<CreateEnrollmentDto>) {
    const enrollment = await this.enrollmentRepo.findOne({ where: { id } });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (dto.payment_date && dto.duration_days) {
      const paymentDate = new Date(dto.payment_date);
      const expiryDate = new Date(paymentDate);
      expiryDate.setDate(expiryDate.getDate() + dto.duration_days);
      (dto as any).expiry_date = expiryDate.toISOString().split('T')[0];
    }

    Object.assign(enrollment, dto);
    return this.enrollmentRepo.save(enrollment);
  }

  // Import a whole distributed class/p-level into feeding or transport as a
  // MEMBERSHIP (no payment yet). The accountant then ticks the monthly B/L
  // boxes in the Feeding/Transport grid. Already-enrolled students are skipped.
  async bulkEnroll(dto: BulkEnrollDto) {
    let created = 0;
    let skipped = 0;

    // Prune any duplicate student IDs from the request batch
    const uniqueStudentIds = Array.from(new Set(dto.student_ids ?? []));

    for (const sid of uniqueStudentIds) {
      const existing = await this.enrollmentRepo.findOne({
        where: { student_id: sid, type: dto.type, status: 'active' },
      });
      if (existing) { skipped++; continue; }

      const enrollment = this.enrollmentRepo.create({
        student_id: sid,
        type: dto.type,
        meal_type: null,
        zone_id: dto.type === 'transport' ? (dto.zone_id ?? null) : null,
        payments: {},
      });
      await this.enrollmentRepo.save(enrollment);
      created++;
    }

    return { created, skipped, total: uniqueStudentIds.length };
  }

  // Replace the monthly payment grid for one enrollment. Each cell value is an
  // object { paid_on, months, expires_on } so we can track expiry per payment.
  async updatePayments(id: number, payments: Record<string, any>) {
    const e = await this.enrollmentRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Enrollment not found');
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(payments ?? {})) {
      if (!v) continue;
      if (typeof v === 'object' && v.paid_on) {
        clean[k] = { paid_on: v.paid_on, months: v.months ?? 1, expires_on: v.expires_on };
      } else {
        // backward-compatible: a bare truthy becomes a 1-month payment from today
        const paidOn = new Date().toISOString().split('T')[0];
        const exp = new Date(); exp.setMonth(exp.getMonth() + 1);
        clean[k] = { paid_on: paidOn, months: 1, expires_on: exp.toISOString().split('T')[0] };
      }
    }
    e.payments = clean;
    await this.enrollmentRepo.save(e);
    return { id, payments: clean };
  }

  // Set the transport zone for one enrollment.
  async setZone(id: number, zoneId: number | null) {
    const e = await this.enrollmentRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Enrollment not found');
    e.zone_id = zoneId;
    await this.enrollmentRepo.save(e);
    return { id, zone_id: zoneId };
  }

  // Waive (archive) a student's active enrollment of a given type — used by the
  // slide-to-reveal trash action in the Class List module.
  async waiveByStudent(studentId: number, type: 'feeding' | 'transport') {
    const active = await this.enrollmentRepo.find({
      where: { student_id: studentId, type, status: 'active' },
    });
    for (const e of active) {
      e.status = 'archived';
      await this.enrollmentRepo.save(e);
    }
    return { waived: active.length };
  }

  async archiveEnrollment(id: number) {
    const enrollment = await this.enrollmentRepo.findOne({ where: { id } });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    enrollment.status = 'archived';
    await this.enrollmentRepo.save(enrollment);
    return { message: 'Enrollment archived' };
  }

  // Expand each enrollment's payment cells; return one row per cell whose
  // expires_on falls within [today, today+daysAhead]. Shape matches the
  // enrollment screens (meal_type derived from the cell key).
  async getExpiringEnrollments(daysAhead = 3) {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + daysAhead);
    const todayStr = today.toISOString().split('T')[0];
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const rows = await this.rawEnrollments();
    const out: any[] = [];
    for (const r of rows) {
      const payments = r.payments ?? {};
      for (const [key, val] of Object.entries<any>(payments)) {
        if (!val?.expires_on) continue;
        if (val.expires_on >= todayStr && val.expires_on <= cutoffStr) {
          out.push({
            ...this.mapEnrollmentRow(r),
            cell_key: key,
            cell_label: this.cellLabel(r.type, key),
            meal_type: r.type === 'feeding' ? (key.endsWith('B') ? 'breakfast' : 'lunch') : null,
            expiry_date: val.expires_on,
            paid_on: val.paid_on,
          });
        }
      }
    }
    out.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
    return out;
  }

  // ─── Cron helper: fire expiry notifications ──────────────────────────────────

  // Returns one item per payment cell whose expiry is exactly `days` from today.
  async getEnrollmentsExpiringInDays(days: number) {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const targetStr = target.toISOString().split('T')[0];

    const rows = await this.rawEnrollments();
    const out: { studentName: string; type: string; label: string; expires_on: string }[] = [];
    for (const r of rows) {
      const payments = r.payments ?? {};
      for (const [key, val] of Object.entries<any>(payments)) {
        if (val?.expires_on === targetStr) {
          out.push({
            studentName: r.student_name,
            type: r.type,
            label: this.cellLabel(r.type, key),
            expires_on: val.expires_on,
          });
        }
      }
    }
    return out;
  }
}
