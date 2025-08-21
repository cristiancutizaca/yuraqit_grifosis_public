import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query,
  Put,
  UseGuards,
  Request,
  SetMetadata,
  ParseIntPipe
} from '@nestjs/common';
import { SalesService, SaleFilters } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PumpsService } from '../pumps/pumps.service';

// Decorador para permitir cualquier rol autenticado
const AllowAnyRole = () => SetMetadata('allow-any-role', true);

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly pumpsService: PumpsService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getSales(
    @Query('limit') limit?: number
  ) {
    if (limit) {
      return this.salesService.getRecentSales(limit);
    }
    return this.salesService.getAllSales();
  }

  @Get('recent')
  async getRecentSales(@Query('limit') limit: number = 10) {
    return this.salesService.findRecent(limit);
  }

  @AllowAnyRole()
  @Post()
  create(@Body() createSaleDto: CreateSaleDto) {
    return this.salesService.create(createSaleDto);
  }

  @AllowAnyRole()
  @Get()
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('clientId') clientId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('employeeId') employeeId?: string
  ) {
    const filters: SaleFilters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (clientId) filters.clientId = +clientId;
    if (productId) filters.productId = +productId;
    if (status) filters.status = status;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (employeeId) filters.employeeId = +employeeId;
    return this.salesService.findAll(filters);
  }

  @AllowAnyRole()
  @Get('pumps/products')
  getAllPumpsWithProducts() {
    return this.pumpsService.getProductsForAllPumps();
  }

  @AllowAnyRole()
  @Get('pumps/:id/products')
  getProductsForPump(@Param('id', ParseIntPipe) pumpId: number) {
    return this.pumpsService.getProductsForPump(pumpId);
  }

  @AllowAnyRole()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(+id);
  }

  @AllowAnyRole()
  @Put(':id/cancel')
  cancelSale(
    @Param('id') id: string,
    @Body() data: { reason: string },
    @Request() req: any
  ) {
    const userId = req.user.id || req.user.userId; // Según como guardes el id
    const userRole = req.user.role || 'user';
    return this.salesService.cancelSale(+id, userId, data.reason, userRole);
  }

  @AllowAnyRole()
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSaleDto: UpdateSaleDto) {
    return this.salesService.update(+id, updateSaleDto);
  }

  @AllowAnyRole()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.salesService.remove(+id);
  }

  // Pública (sin guards, sin roles, ni autenticación)
  @Get('public-data')
  getPublicData() {
    return this.salesService.getPublicData();
  }

  // sales.controller.ts
  @Get('recent')
  async getRecent(@Query('limit') limit?: string) {
    const take = Math.min(Math.max(Number(limit) || 25, 1), 100);
    return this.salesService.getRecentSales(take);
  }

  
}