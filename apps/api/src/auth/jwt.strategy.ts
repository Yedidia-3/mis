import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-fallback-secret-key',
    });
  }

  async validate(payload: any) {
    // Expose id, email and role so every controller and guard can use them
    // via @CurrentUser() or req.user without touching any other file.
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
