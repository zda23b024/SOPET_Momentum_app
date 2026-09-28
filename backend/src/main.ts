import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { validateProductionEnvironment } from './config/configuration';

async function bootstrap() {
  validateProductionEnvironment();
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  if (process.env.TRUST_PROXY === 'true') app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    }),
  );

  // Cookie parsing for secure refresh token rotation
  app.use(cookieParser());

  // CORS configuration
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [frontendUrl]
    : [frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-ID'],
  });

  // Global Route Prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global Filters & Interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SOPET Momentum API')
    .setDescription(
      'REST API specification for SOPET Momentum — Personal execution and developmental progress system by ACoS EduTech and Consultancy.',
    )
    .setVersion('1.0.0')
    .addTag('Authentication', 'Argon2id authentication, session issuance and token rotation')
    .addTag('Sessions', 'Device and session inspection and revocation')
    .addTag('Goals', 'Goal management with ownership isolation')
    .addTag('Actions', 'Action pipeline and Next Meaningful Action (NMA) designation')
    .addTag('Action Readiness', '5-Question diagnostic readiness protocol')
    .addTag('Barriers', 'Action-Centric Identification Framework (ACIF) diagnosis')
    .addTag('Interventions', 'Approved methodology interventions')
    .addTag('Minimum Meaningful Action (MMA)', 'Momentum-restoring micro-steps')
    .addTag('Interruption & Restart', '5-Question Restart Protocol')
    .addTag('Weekly Review & Lessons', '5-Question review, lesson extraction and NMA anchoring')
    .addTag('KPIs & Progress', 'The 6 core momentum metrics')
    .addTag('AI Methodology Engine', 'Governed AI assistance with Gemini 2.5 Flash')
    .addTag('Privacy & Encryption', 'Client-side key metadata registration')
    .addTag('Administration & Security', 'Audit logs and system health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') SwaggerModule.setup('api/docs', app, document);

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);
  logger.log(`SOPET Momentum API server listening on http://localhost:${port}/api/v1`);
  logger.log(`OpenAPI Swagger documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
