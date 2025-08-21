import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Param, 
  Body, 
  ParseIntPipe,
  HttpCode,
  HttpStatus 
} from '@nestjs/common';
import { PumpsTanksService } from './pumps-tanks.service';
import { CreatePumpTankDto } from './dto/create-pump-tank.dto';
import { UpdatePumpTankDto } from './dto/update-pump-tank.dto';

@Controller('pumps-tanks')
export class PumpsTanksController {
  constructor(private readonly pumpsTanksService: PumpsTanksService) {}

  @Get()
  getAllPumpTankRelations() {
    return this.pumpsTanksService.getAllPumpTankRelations();
  }

  @Get(':id')
  getPumpTankRelationById(@Param('id', ParseIntPipe) id: number) {
    return this.pumpsTanksService.getPumpTankRelationById(id);
  }

  @Get('pump/:pumpId')
  getTanksByPumpId(@Param('pumpId', ParseIntPipe) pumpId: number) {
    return this.pumpsTanksService.getTanksByPumpId(pumpId);
  }

  @Get('tank/:tankId')
  getPumpsByTankId(@Param('tankId', ParseIntPipe) tankId: number) {
    return this.pumpsTanksService.getPumpsByTankId(tankId);
  }

  @Post('assign-tanks')
  @HttpCode(HttpStatus.CREATED)
  assignTanks(@Body() createPumpTankDto: CreatePumpTankDto) {
    const { pump_id, tank_ids } = createPumpTankDto;
    return this.pumpsTanksService.assignTanksToPump(pump_id, tank_ids);
  }

  @Put(':id')
  updatePumpTankRelation(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePumpTankDto: UpdatePumpTankDto
  ) {
    return this.pumpsTanksService.updatePumpTankRelation(id, updatePumpTankDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePumpTankRelation(@Param('id', ParseIntPipe) id: number) {
    return this.pumpsTanksService.deletePumpTankRelation(id);
  }

  @Delete('pump/:pumpId/tank/:tankId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSpecificPumpTankRelation(
    @Param('pumpId', ParseIntPipe) pumpId: number,
    @Param('tankId', ParseIntPipe) tankId: number
  ) {
    return this.pumpsTanksService.removeSpecificPumpTankRelation(pumpId, tankId);
  }

  @Put('pump/:pumpId/tanks')
  replaceTanksForPump(
    @Param('pumpId', ParseIntPipe) pumpId: number,
    @Body('tankIds') tankIds: number[]
  ) {
    return this.pumpsTanksService.replaceTanksForPump(pumpId, tankIds);
  }
}