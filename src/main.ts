import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { RolesGuard } from './auth/roles.guard'; // Asumiendo que tienes este guard
import { Reflector } from '@nestjs/core'; // Asumiendo que usas Reflector con RolesGuard

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilita CORS para el frontend (React, Next.js, etc)
  // Al llamar a enableCors() sin argumentos, NestJS habilita CORS para *todos* los orígenes.
  app.enableCors();

  // Prefijo global para la API
  app.setGlobalPrefix('api');

  // Activar validaciones globales de DTO y transformar el body correctamente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Solo permite propiedades que estén en el DTO
      transform: true, // Transforma los datos al tipo definido en el DTO
      forbidNonWhitelisted: false, // Lanza un error si hay propiedades no definidas
    })
  );

  // Activar tu RolesGuard global (si lo estás usando)
  // app.useGlobalGuards(new RolesGuard(new Reflector())); // Descomentar si usas RolesGuard globalmente

  // Iniciar servidor en el puerto 8000 o el definido en variables de entorno
  await app.listen(process.env.PORT ?? 8000);
  console.log(` API corriendo en: http://localhost:${process.env.PORT ?? 8000}/api`);
}

bootstrap();