import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { LoginDto } from './dto/login.dto';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user) throw new UnauthorizedException('Invalid email or password');

    if (user.status === 'inactive') throw new UnauthorizedException('Your account is inactive. Contact your administrator.');

    if (user.locked_until && user.locked_until > new Date()) {
      throw new UnauthorizedException('Your account has been locked. Contact your administrator.');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      user.failed_login_attempts += 1;
      if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
        user.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        user.failed_login_attempts = 0;
      }
      await this.userRepo.save(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    user.failed_login_attempts = 0;
    user.locked_until = null;
    user.last_login = new Date();
    await this.userRepo.save(user);

    const token = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '2h' },
    );

    const { password, ...safeUser } = user;
    return { token, user: safeUser };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    if (currentPassword === newPassword)
      throw new BadRequestException('New password must be different from your current password');

    user.password = await bcrypt.hash(newPassword, 10);
    user.must_change_password = false;
    await this.userRepo.save(user);
    return { message: 'Password changed successfully' };
  }

  async me(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const { password, ...safeUser } = user;
    return safeUser;
  }

  // Self-service profile update: name and/or avatar.
  async updateProfile(userId: number, dto: { name?: string; avatar?: string }) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (typeof dto.name === 'string' && dto.name.trim()) user.name = dto.name.trim();
    if (typeof dto.avatar === 'string') user.avatar = dto.avatar || null;
    await this.userRepo.save(user);
    const { password, ...safeUser } = user;
    return safeUser;
  }
}
