import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AcademicYear } from '../entities/academic-year.entity';
import { PLevel } from '../entities/p-level.entity';
import { ShuffleSession } from '../entities/shuffle-session.entity';
import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(AcademicYear) private yearRepo: Repository<AcademicYear>,
    @InjectRepository(ShuffleSession) private shuffleSessionRepo: Repository<ShuffleSession>,
    @InjectRepository(PLevel) private pLevelRepo: Repository<PLevel>,
    private audit: AuditService,
  ) {}

  // First-run seed: if there are no users at all, create the root Super Admin
  // so a fresh deployment can be logged into without shell access.
  async onApplicationBootstrap() {
    const count = await this.userRepo.count();
    if (count > 0) return;
    const email = 'admin@jericho.rw';
    const password = 'Admin@Jericho2025!';
    const hash = await bcrypt.hash(password, 10);
    await this.userRepo.save(
      this.userRepo.create({
        name: 'Super Admin',
        email,
        password: hash,
        role: 'super_admin' as any,
        must_change_password: true,
      }),
    );
    this.logger.log(`Seeded initial Super Admin → ${email} / ${password} (must change on first login)`);
  }

  async listUsers() {
    return this.userRepo.find({
      select: ['id', 'name', 'email', 'role', 'status', 'must_change_password', 'last_login', 'created_at'],
      order: { created_at: 'DESC' },
    });
  }

  /** Returns non-admin staff (dean, principal, teacher, accountant) — accessible to dean/principal */
  async listStaff(role?: string) {
    const qb = this.userRepo.createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.email', 'u.role', 'u.status'])
      .where('u.role != :admin', { admin: 'super_admin' })
      .andWhere('u.status = :status', { status: 'active' });
    if (role) qb.andWhere('u.role = :role', { role });
    return qb.orderBy('u.name', 'ASC').getMany();
  }

  private generateTempPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const specials = '@#!$';
    const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
    const pwd = rand(upper) + rand(upper) + rand(lower) + rand(lower) + rand(lower) + rand(digits) + rand(digits) + rand(specials);
    return pwd.split('').sort(() => 0.5 - Math.random()).join('');
  }

  async createUser(dto: CreateUserDto) {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('A user with this email already exists');

    const tempPassword = this.generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      role: dto.role as any,
      password: hashed,
      must_change_password: true,
    });
    const saved = await this.userRepo.save(user);
    const { password, ...safe } = saved as any;
    return { ...safe, temp_password: tempPassword };
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    Object.assign(user, dto);
    const saved = await this.userRepo.save(user);
    const { password, ...safe } = saved;
    return safe;
  }

  async deleteUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'super_admin') {
      const superAdminCount = await this.userRepo.count({ where: { role: 'super_admin' as any } });
      if (superAdminCount <= 1) {
        throw new BadRequestException('The last super admin cannot be deleted. Deactivate it instead or create another super admin first.');
      }
    }

    const deletedName = user.name;
    await this.userRepo.delete(id);
    return { message: `User ${deletedName} has been permanently deleted` };
  }

  async deactivateUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.status = 'inactive';
    await this.userRepo.save(user);
    return { message: `User ${user.name} has been deactivated` };
  }

  async resetPassword(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const tempPassword = this.generateTempPassword();
    user.password = await bcrypt.hash(tempPassword, 10);
    user.must_change_password = true;
    user.failed_login_attempts = 0;
    user.locked_until = null;
    await this.userRepo.save(user);
    return { message: 'Password reset successfully', temp_password: tempPassword };
  }

  async listAcademicYears() {
    return this.yearRepo.find({ order: { created_at: 'DESC' } });
  }

  async createAcademicYear(name: string) {
    const exists = await this.yearRepo.findOne({ where: { name } });
    if (exists) throw new BadRequestException('Academic year already exists');
    const year = this.yearRepo.create({ name });
    return this.yearRepo.save(year);
  }

  async archiveAcademicYear(id: number) {
    const year = await this.yearRepo.findOne({ where: { id } });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.status === 'archived') throw new BadRequestException('Already archived');
    year.status = 'archived';
    year.archived_at = new Date();
    return this.yearRepo.save(year);
  }

  // Super Admin requests deletion → notify principals for approval.
  async requestYearDeletion(id: number) {
    const year = await this.yearRepo.findOne({ where: { id } });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.deletion_status === 'pending') throw new BadRequestException('Deletion already pending approval');
    year.deletion_status = 'pending';
    year.deletion_requested_at = new Date();
    await this.yearRepo.save(year);

    const principals = await this.userRepo.find({ where: { role: 'principal' as any, status: 'active' } });
    for (const p of principals) {
      await this.audit.log({
        actor_name: 'System', actor_role: 'system',
        action: 'Deletion requested',
        details: `Super Admin requested deletion of academic year ${year.name} — awaiting your approval`,
      });
    }
    // Notify via notifications too (reuse audit only here; principals see it in their dashboard list)
    return { message: 'Deletion request sent to the Principal for approval', year };
  }

  // Principal approves → the year and all its data are permanently deleted (FK cascade).
  async approveYearDeletion(id: number) {
    const year = await this.yearRepo.findOne({ where: { id } });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.deletion_status !== 'pending') throw new BadRequestException('No pending deletion request for this year');
    const name = year.name;
    await this.yearRepo.delete(id); // cascades to p_levels → classes → students → sessions, etc.
    return { message: `Academic year ${name} deleted` };
  }

  // Principal rejects → clears the request.
  async rejectYearDeletion(id: number) {
    const year = await this.yearRepo.findOne({ where: { id } });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.deletion_status !== 'pending') throw new BadRequestException('No pending deletion request');
    year.deletion_status = 'rejected';
    year.deletion_requested_at = null;
    await this.yearRepo.save(year);
    return { message: `Deletion request for ${year.name} rejected` };
  }

  // Years with a pending deletion request (for the Principal to review).
  async pendingYearDeletions() {
    return this.yearRepo.find({
      where: { deletion_status: 'pending' as any },
      order: { deletion_requested_at: 'DESC' },
    });
  }

  // Real audit log — every mutating action is captured by the global
  // AuditInterceptor and stored, so this reflects the full activity history.
  async getAuditLog() {
    return this.audit.list(1000);
  }
}
