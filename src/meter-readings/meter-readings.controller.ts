import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MeterReadingsService } from './meter-readings.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';

@Controller('meter-readings')
export class MeterReadingsController {
  constructor(private readonly meterReadingsService: MeterReadingsService) {}

  @Post()
  create(@Body() createMeterReadingDto: CreateMeterReadingDto) {
    return this.meterReadingsService.create(createMeterReadingDto);
  }

  @Get()
  findAll() {
    return this.meterReadingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.meterReadingsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMeterReadingDto: UpdateMeterReadingDto) {
    return this.meterReadingsService.update(+id, updateMeterReadingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.meterReadingsService.remove(+id);
  }
}
