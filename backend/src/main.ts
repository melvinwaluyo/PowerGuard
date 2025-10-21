import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for mobile app
  app.enableCors({
    origin: '*', // For development - restrict this in production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('PowerGuard API')
    .setDescription('Backend API for PowerGuard smart outlet management system')
    .setVersion('1.0')
    .addTag('geofence', 'Geofencing settings')
    .addTag('outlets', 'Outlet management and control')
    .addTag('powerstrips', 'Power strip devices')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`PowerGuard backend is running on: http://localhost:${port}`);
  console.log(`Swagger API docs available at: http://localhost:${port}/docs`);
}
bootstrap();
