import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TanksService } from './tanks.service';
import { CreateTankDto } from './dto/create-tank.dto';
import { UpdateTankDto } from './dto/update-tank.dto';

@Controller('tanks')
export class TanksController {
  constructor(private readonly tanksService: TanksService) {}

  @Post()
  create(@Body() createTankDto: CreateTankDto) {
    return this.tanksService.create(createTankDto);
  }

  @Get()
  findAll() {
    return this.tanksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tanksService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTankDto: UpdateTankDto) {
    return this.tanksService.update(+id, updateTankDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tanksService.remove(+id);
  }
}
