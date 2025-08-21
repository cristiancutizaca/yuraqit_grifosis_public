import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { NozzlesService } from './nozzles.service';
import { CreateNozzleDto } from './dto/create-nozzle.dto';
import { UpdateNozzleDto } from './dto/update-nozzle.dto';

@Controller('nozzles')
export class NozzlesController {
  constructor(private readonly nozzlesService: NozzlesService) {}

  @Post()
  create(@Body() createNozzleDto: CreateNozzleDto) {
    return this.nozzlesService.create(createNozzleDto);
  }

  @Get()
  findAll() {
    return this.nozzlesService.findAll();
  }

  @Get('pumps')
  getAllPumps() {
    return this.nozzlesService.getPumps();
  }

  @Get('active')
  findActiveNozzles() {
    return this.nozzlesService.findActiveNozzles();
  }

  @Get('pumps')
  getPumps() {
    return this.nozzlesService.getPumps();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNozzleDto: UpdateNozzleDto) {
    return this.nozzlesService.update(+id, updateNozzleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.nozzlesService.remove(+id);
  }
}