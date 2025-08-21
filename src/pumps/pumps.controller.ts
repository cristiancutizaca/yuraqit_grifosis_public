import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { PumpsService } from './pumps.service';
import { CreatePumpDto } from './dto/create-pump.dto';
import { UpdatePumpDto } from './dto/update-pump.dto';

@Controller('pumps')
export class PumpsController {
  constructor(private readonly pumpsService: PumpsService) {}

  @Post()
  create(@Body() createPumpDto: CreatePumpDto) {
    return this.pumpsService.create(createPumpDto);
  }

  @Get()
  findAll() {
    return this.pumpsService.findAll();
  }

  @Get('products')
  getAllProducts() {
    return this.pumpsService.getProductsForAllPumps();
  }

  @Get(':id/products')
  async getProductsForPump(@Param('id', ParseIntPipe) pumpId: number) {
    return this.pumpsService.getProductsForPump(pumpId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pumpsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePumpDto: UpdatePumpDto,
  ) {
    return this.pumpsService.update(id, updatePumpDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pumpsService.remove(id);
  }
}
