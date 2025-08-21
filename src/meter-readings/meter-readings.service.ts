import { Injectable } from '@nestjs/common';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';

@Injectable()
export class MeterReadingsService {
  create(createMeterReadingDto: CreateMeterReadingDto) {
    return 'This action adds a new meterReading';
  }

  findAll() {
    return `This action returns all meterReadings`;
  }

  findOne(id: number) {
    return `This action returns a #${id} meterReading`;
  }

  update(id: number, updateMeterReadingDto: UpdateMeterReadingDto) {
    return `This action updates a #${id} meterReading`;
  }

  remove(id: number) {
    return `This action removes a #${id} meterReading`;
  }
}
