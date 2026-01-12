// Load .env file FIRST, before any other imports (using require to execute before imports)
require('dotenv').config();

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

async function bootstrap() {
  // Validate required environment variables
  if (!process.env.JWT_SECRET) {
    console.error('❌ ERROR: JWT_SECRET environment variable is required!');
    console.error('Please set JWT_SECRET in your .env file.');
    process.exit(1);
  }

  // Set timezone to Eastern Time (America/New_York)
  // This ensures all date/time operations use EST/EDT
  process.env.TZ = 'America/New_York';

  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Apply JWT auth guard globally (routes can opt-out with @Public decorator)
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
