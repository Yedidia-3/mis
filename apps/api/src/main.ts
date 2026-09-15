import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { ResponseInterceptor } from './common/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Auth uses Bearer tokens in the Authorization header, not cookies, so
  // credentials:true is unnecessary — and it would forbid a wildcard origin.
  //
  // Production: only the origins named in FRONTEND_URL may call the API.
  // Development: any localhost port is accepted. Vite silently moves to 5174,
  // 5175… when its default port is taken, and pinning a single port turns that
  // into an opaque "Failed to fetch" on the login screen with nothing in the
  // API logs to explain it — the browser blocks the request before it is sent.
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  if (isProduction && !allowedOrigins.length) {
    console.warn(
      'WARNING: FRONTEND_URL is not set. Every browser request will be blocked by CORS.',
    );
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin and non-browser callers (curl, uptime checks) send no Origin.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProduction && LOCALHOST_ORIGIN.test(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: false,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`Jericho API running on http://${host}:${port}`);
}

bootstrap();
