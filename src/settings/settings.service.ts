import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { CreateSettingDto } from './dto/create-setting.dto';
import { ShiftDto } from './dto/shift.dto';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private repo: Repository<Setting>,
    private dataSource: DataSource,
  ) {}

  async findOne(): Promise<Setting> {
    const setting = await this.repo.findOne({ where: { setting_id: 1 } });
    if (!setting) {
      throw new NotFoundException('Configuración no encontrada');
    }
    return setting;
  }

  async update(data: UpdateSettingDto): Promise<Setting> {
    const existingSetting = await this.repo.findOne({ where: { setting_id: 1 } });
    if (!existingSetting) {
      throw new NotFoundException('Configuración no encontrada');
    }

    if (data.company_ruc && data.company_ruc !== existingSetting.company_ruc) {
      const existingRuc = await this.repo.findOne({ 
        where: { company_ruc: data.company_ruc } 
      });
      if (existingRuc && existingRuc.setting_id !== 1) {
        throw new BadRequestException('El RUC ya está registrado');
      }
    }

    if (data.email && data.email !== existingSetting.email) {
      const existingEmail = await this.repo.findOne({ 
        where: { email: data.email } 
      });
      if (existingEmail && existingEmail.setting_id !== 1) {
        throw new BadRequestException('El email ya está registrado');
      }
    }

    // Merge the incoming data with the existing setting and save
    Object.assign(existingSetting, data);

    existingSetting.updated_at = new Date();

    return this.repo.save(existingSetting);
  }

  async create(data: CreateSettingDto): Promise<Setting> {
    const existingSetting = await this.repo.findOne({ where: { setting_id: 1 } });
    if (existingSetting) {
      throw new BadRequestException('Ya existe una configuración. Use el método de actualización.');
    }

    const existingRuc = await this.repo.findOne({ 
      where: { company_ruc: data.company_ruc } 
    });
    if (existingRuc) {
      throw new BadRequestException('El RUC ya está registrado');
    }

    const existingEmail = await this.repo.findOne({ 
      where: { email: data.email } 
    });
    if (existingEmail) {
      throw new BadRequestException('El email ya está registrado');
    }

    const newSetting = this.repo.create({
      setting_id: 1,
      ...data
    });

    return this.repo.save(newSetting);
  }

  async updateCompanyData(data: Partial<UpdateSettingDto>): Promise<Setting> {
    const companyFields = {
      company_name: data.company_name,
      company_ruc: data.company_ruc,
      address: data.address,
      phone: data.phone,
      email: data.email,
      web_address: data.web_address,
      social_networks: data.social_networks,
      logo: data.logo
    };

    const filteredData = Object.fromEntries(
      Object.entries(companyFields).filter(([_, value]) => value !== undefined)
    );

    return this.update(filteredData);
  }

  // Database Backup and Restore methods

  async createBackup(): Promise<{ success: boolean; filename: string; path: string; message: string }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `grifosis_backup_${timestamp}.sql`;
      const backupDir = path.join(process.cwd(), 'backups');
      
      // Crear directorio de backups si no existe
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const backupPath = path.join(backupDir, filename);
      
      // Obtener configuración de la base de datos
      const dbConfig = this.dataSource.options as any;
      
      // Comando pg_dump para PostgreSQL
      const command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${backupPath}" --no-password`;
      
      // Configurar variable de entorno para la contraseña
      const env = { ...process.env, PGPASSWORD: dbConfig.password };
      
      await execAsync(command, { env });

      return {
        success: true,
        filename,
        path: backupPath,
        message: 'Backup creado exitosamente'
      };
    } catch (error) {
      throw new BadRequestException(`Error al crear backup: ${error.message}`);
    }
  }

  async restoreBackup(backupPath: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(backupPath)) {
        throw new BadRequestException('El archivo de backup no existe');
      }

      // Obtener configuración de la base de datos
      const dbConfig = this.dataSource.options as any;
      
      // Comando psql para restaurar
      const command = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${backupPath}" --no-password`;
      
      // Configurar variable de entorno para la contraseña
      const env = { ...process.env, PGPASSWORD: dbConfig.password };
      
      await execAsync(command, { env });

      return {
        success: true,
        message: 'Base de datos restaurada exitosamente'
      };
    } catch (error) {
      throw new BadRequestException(`Error al restaurar backup: ${error.message}`);
    }
  }

  async listBackups(): Promise<{ backups: Array<{ filename: string; path: string; size: number; created: Date }> }> {
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      
      if (!fs.existsSync(backupDir)) {
        return { backups: [] };
      }

      const files = fs.readdirSync(backupDir);
      const backups = files
        .filter(file => file.endsWith('.sql'))
        .map(file => {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime
          };
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime());

      return { backups };
    } catch (error) {
      throw new BadRequestException(`Error al listar backups: ${error.message}`);
    }
  }

  async deleteBackup(filename: string): Promise<{ success: boolean; message: string }> {
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      const backupPath = path.join(backupDir, filename);
      
      if (!fs.existsSync(backupPath)) {
        throw new BadRequestException('El archivo de backup no existe');
      }

      fs.unlinkSync(backupPath);

      return {
        success: true,
        message: 'Backup eliminado exitosamente'
      };
    } catch (error) {
      throw new BadRequestException(`Error al eliminar backup: ${error.message}`);
    }
  }

  async getDatabaseInfo(): Promise<any> {
    try {
      const dbConfig = this.dataSource.options as any;
      
      // Obtener información de las tablas
      const tablesQuery = `
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
      `;
      
      const tables = await this.dataSource.query(tablesQuery);
      
      // Obtener tamaño total de la base de datos
      const sizeQuery = `
        SELECT pg_size_pretty(pg_database_size('${dbConfig.database}')) as database_size;
      `;
      
      const sizeResult = await this.dataSource.query(sizeQuery);
      
      return {
        database: dbConfig.database,
        host: dbConfig.host,
        port: dbConfig.port,
        size: sizeResult[0]?.database_size || 'N/A',
        tables: tables || []
      };
    } catch (error) {
      throw new BadRequestException(`Error al obtener información de la base de datos: ${error.message}`);
    }
  }

  // Shift management methods

  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private checkOverlap(existingShifts: { [key: string]: string }, newShift: ShiftDto): boolean {
    const newStart = this.parseTime(newShift.startTime);
    const newEnd = this.parseTime(newShift.endTime);

    for (const key in existingShifts) {
      if (existingShifts.hasOwnProperty(key)) {
        const [existingStartStr, existingEndStr] = existingShifts[key].split('-');
        const existingStart = this.parseTime(existingStartStr);
        const existingEnd = this.parseTime(existingEndStr);

        // Handle overnight shifts
        const isNewOvernight = newStart >= newEnd;
        const isExistingOvernight = existingStart >= existingEnd;

        if (isNewOvernight && isExistingOvernight) {
          // Both overnight, check for overlap within the 24-hour cycle
          // This logic needs to be more robust for overnight shifts. For simplicity, let's assume non-overnight for now.
          // A more complete solution would involve converting times to a common scale (e.g., minutes from midnight) and handling wrap-around.
          // For now, a basic overlap check for non-overnight shifts.
          if (!((newEnd <= existingStart && newStart >= existingEnd) || (existingEnd <= newStart && existingStart >= newEnd))) {
            return true; // Overlap
          }
        } else if (isNewOvernight) {
          // New is overnight, existing is not
          // Check if new shift overlaps with existing shift considering the overnight wrap-around
          if ((newStart <= existingStart && newEnd >= existingStart) || (newStart <= existingEnd && newEnd >= existingEnd) || (existingStart <= newStart && existingEnd >= newStart) || (existingStart <= newEnd && existingEnd >= newEnd)) {
            return true; // Overlap
          }
        } else if (isExistingOvernight) {
          // Existing is overnight, new is not
          // Check if new shift overlaps with existing shift considering the overnight wrap-around
          if ((existingStart <= newStart && existingEnd >= newStart) || (existingStart <= newEnd && existingEnd >= newEnd) || (newStart <= existingStart && newEnd >= existingStart) || (newStart <= existingEnd && newEnd >= existingEnd)) {
            return true; // Overlap
          }
        } else {
          // Neither is overnight
          if (Math.max(newStart, existingStart) < Math.min(newEnd, existingEnd)) {
            return true; // Overlap
          }
        }
      }
    }
    return false;
  }

  async getShifts(): Promise<{ [key: string]: string }> {
    const setting = await this.findOne();
    try {
      return setting.shift_hours ? JSON.parse(setting.shift_hours) : {};
    } catch {
      return {};
    }
  }

  async addShift(shiftDto: ShiftDto): Promise<{ [key: string]: string }> {
    const setting = await this.findOne();
    const currentShifts = setting.shift_hours ? JSON.parse(setting.shift_hours) : {};

    if (currentShifts[shiftDto.name]) {
      throw new BadRequestException(`El turno con el nombre '${shiftDto.name}' ya existe.`);
    }

    if (this.checkOverlap(currentShifts, shiftDto)) {
      throw new BadRequestException('El nuevo turno se solapa con un turno existente.');
    }

    currentShifts[shiftDto.name] = `${shiftDto.startTime}-${shiftDto.endTime}`;
    
    // Use the refactored update method to preserve other fields
    await this.update({ shift_hours: currentShifts });
    return currentShifts;
  }

  async updateShift(shiftName: string, shiftDto: ShiftDto): Promise<{ [key: string]: string }> {
    const setting = await this.findOne();
    const currentShifts = setting.shift_hours ? JSON.parse(setting.shift_hours) : {};

    if (!currentShifts[shiftName]) {
      throw new NotFoundException(`El turno con el nombre '${shiftName}' no existe.`);
    }

    // Temporarily remove the shift being updated to check for overlaps with others
    const shiftsWithoutCurrent = { ...currentShifts };
    delete shiftsWithoutCurrent[shiftName];

    if (this.checkOverlap(shiftsWithoutCurrent, shiftDto)) {
      throw new BadRequestException('El turno actualizado se solapa con un turno existente.');
    }

    currentShifts[shiftName] = `${shiftDto.startTime}-${shiftDto.endTime}`;
    
    // Use the refactored update method to preserve other fields
    await this.update({ shift_hours: currentShifts });
    return currentShifts;
  }

  async deleteShift(shiftName: string): Promise<{ [key: string]: string }> {
    const setting = await this.findOne();
    const currentShifts = setting.shift_hours ? JSON.parse(setting.shift_hours) : {};

    if (!currentShifts[shiftName]) {
      throw new NotFoundException(`El turno con el nombre '${shiftName}' no existe.`);
    }

    delete currentShifts[shiftName];
    
    // Use the refactored update method to preserve other fields
    await this.update({ shift_hours: currentShifts });
    return currentShifts;
  }
}


