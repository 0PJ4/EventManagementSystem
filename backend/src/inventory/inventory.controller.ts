import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { InventoryService } from '../services/inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

/**
 * Inventory Controller
 * 
 * Provides REST API endpoints for managing inventory transactions
 * and querying inventory balances.
 */
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Get current balance for a resource
   */
  @Get('balance/:resourceId')
  @Roles(UserRole.ADMIN, UserRole.ORG)
  async getCurrentBalance(@Param('resourceId') resourceId: string) {
    const balance = await this.inventoryService.getCurrentBalance(resourceId);
    return { resourceId, balance, timestamp: new Date() };
  }

  /**
   * Get projected balance at a specific date
   */
  @Get('projected-balance/:resourceId')
  @Roles(UserRole.ADMIN, UserRole.ORG)
  async getProjectedBalance(
    @Param('resourceId') resourceId: string,
    @Query('date') dateStr: string,
  ) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const balance = await this.inventoryService.getProjectedBalance(resourceId, targetDate);
    return { resourceId, balance, projectedDate: targetDate };
  }

  /**
   * Get transaction history for a resource
   */
  @Get('history/:resourceId')
  @Roles(UserRole.ADMIN, UserRole.ORG)
  async getTransactionHistory(
    @Param('resourceId') resourceId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.inventoryService.getTransactionHistory(resourceId, start, end);
  }

  /**
   * Get running balance over time (for charts/visualization)
   */
  @Get('running-balance/:resourceId')
  @Roles(UserRole.ADMIN, UserRole.ORG)
  async getRunningBalance(
    @Param('resourceId') resourceId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.inventoryService.getRunningBalanceOverTime(resourceId, start, end);
  }

  /**
   * Create a restock transaction
   */
  @Post('restock')
  @Roles(UserRole.ADMIN, UserRole.ORG)
  async createRestock(
    @Request() req,
    @Body() body: {
      resourceId: string;
      quantity: number;
      restockDate?: string;
      notes?: string;
    },
  ) {
    const restockDate = body.restockDate ? new Date(body.restockDate) : new Date();
    const transaction = await this.inventoryService.createRestockTransaction(
      body.resourceId,
      body.quantity,
      restockDate,
      body.notes,
      req.user.id,
    );
    
    // Return both the transaction and the updated resource balance
    const updatedBalance = await this.inventoryService.getCurrentBalance(body.resourceId);
    return {
      transaction,
      resourceId: body.resourceId,
      newBalance: updatedBalance,
    };
  }

  /**
   * Detect inventory shortages across all resources
   */
  @Get('shortages')
  @Roles(UserRole.ADMIN, UserRole.ORG)
  async detectShortages(@Query('resourceId') resourceId?: string) {
    return this.inventoryService.detectInventoryShortages(resourceId);
  }
}
