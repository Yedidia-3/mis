import { Body, Controller, Get, Post, Put, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from '../entities/user.entity';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.authService.me(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  updateProfile(
    @CurrentUser() user: User,
    @Body('name') name?: string,
    @Body('avatar') avatar?: string,
  ) {
    return this.authService.updateProfile(user.id, { name, avatar });
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: User,
    @Body('current_password') currentPassword: string,
    @Body('new_password') newPassword: string,
  ) {
    if (!currentPassword || !newPassword) throw new BadRequestException('current_password and new_password are required');
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters');
    return this.authService.changePassword(user.id, currentPassword, newPassword);
  }
}
