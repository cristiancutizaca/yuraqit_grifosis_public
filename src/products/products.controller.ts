import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ParseIntPipe } from '@nestjs/common';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get('active')
  findActive() {
    return this.productsService.findActive();
  }

  @Get('stats')
  getProductStats() {
    return this.productsService.getProductStats();
  }

  @Get('search')
  search(@Query('q') searchTerm: string) {
    return this.productsService.search(searchTerm);
  }

  @Get('category/:category')
  findByCategory(@Param('category') category: string) {
    return this.productsService.findByCategory(category);
  }

  @Get('fuel-type/:fuelType')
  findByFuelType(@Param('fuelType') fuelType: string) {
    return this.productsService.findByFuelType(fuelType);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.productsService.activate(+id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.productsService.deactivate(+id);
  }

  @Get(':id/kardex')
  getKardex(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.productsService.getKardex(+id, startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(+id);
  }
}
