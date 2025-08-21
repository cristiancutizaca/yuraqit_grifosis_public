import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post()
  create(@Body() dto: CreateDiscountDto) {
    return this.discountsService.create(dto);
  }

  @Get()
  findAll() {
    return this.discountsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.discountsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDiscountDto) {
    return this.discountsService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.discountsService.remove(+id);
  }
}
