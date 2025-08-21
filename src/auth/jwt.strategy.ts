import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'tu_clave_secreta',
    });
    console.log('🔧 JwtStrategy inicializada con secretOrKey:', process.env.JWT_SECRET || 'tu_clave_secreta');
  }

  async validate(payload: any) {
    console.log('🔍 JwtStrategy.validate() ejecutándose');
    console.log('🔍 Payload recibido:', JSON.stringify(payload, null, 2));
    
    const user = {
      userId: payload.sub,
      username: payload.username,
      role: payload.role
    };
    
    console.log('🔍 User objeto creado:', JSON.stringify(user, null, 2));
    console.log('✅ JwtStrategy.validate() completado exitosamente');
    
    return user;
  }
}