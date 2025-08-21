import { Controller, Get, Post, Put, Body, ValidationPipe, UsePipes, Param, Delete, Query } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { ShiftDto } from './dto/shift.dto';

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  find() {
    return this.settingsService.findOne(); // setting_id = 1
  }

  @Put()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Body() dto: UpdateSettingDto) {
    return this.settingsService.update(dto); // update setting_id = 1
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() dto: CreateSettingDto) {
    return this.settingsService.create(dto); // create setting_id = 1
  }

  @Put("company")
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateCompanyData(@Body() dto: UpdateSettingDto) {
    return this.settingsService.updateCompanyData(dto); // update only company data
  }

  // Database Backup and Restore endpoints

  @Post("backup")
  createBackup() {
    return this.settingsService.createBackup();
  }

  @Post("restore")
  restoreBackup(@Body('backupPath') backupPath: string) {
    return this.settingsService.restoreBackup(backupPath);
  }

  @Get("backups")
  listBackups() {
    return this.settingsService.listBackups();
  }

  @Delete("backups/:filename")
  deleteBackup(@Param("filename") filename: string) {
    return this.settingsService.deleteBackup(filename);
  }

  @Get("database-info")
  getDatabaseInfo() {
    return this.settingsService.getDatabaseInfo();
  }

  // Shift management endpoints

  @Get("shifts")
  getShifts() {
    return this.settingsService.getShifts();
  }

  @Post("shifts")
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  addShift(@Body() shiftDto: ShiftDto) {
    return this.settingsService.addShift(shiftDto);
  }

  @Put("shifts/:name")
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateShift(@Param("name") name: string, @Body() shiftDto: ShiftDto) {
    return this.settingsService.updateShift(name, shiftDto);
  }

  @Delete("shifts/:name")
  deleteShift(@Param("name") name: string) {
    return this.settingsService.deleteShift(name);
  }
}


