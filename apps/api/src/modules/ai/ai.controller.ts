import { Controller, Get, Put, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AIService, AIAnalysisRequest } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI Engine')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Get('providers')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List AI providers' })
  async getProviders() {
    return this.aiService.getProviders();
  }

  @Put('providers/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update AI provider' })
  async updateProvider(
    @Param('id') id: string,
    @Body() updates: { isActive?: boolean; priority?: number; apiKey?: string },
  ) {
    return this.aiService.updateProvider(id, updates);
  }

  @Post('analyze')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Analyze with AI' })
  async analyze(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: AIAnalysisRequest,
  ) {
    return this.aiService.analyze({ ...dto, tenantId });
  }

  @Post('chat')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Chat with AI' })
  async chat(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { message: string; history?: Array<{ role: string; content: string }> },
  ) {
    return this.aiService.chat(tenantId, dto.message, dto.history);
  }
}
