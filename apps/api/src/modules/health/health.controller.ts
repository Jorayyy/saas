import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Basic health check' })
  async health() {
    return this.healthService.check();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  async ready() {
    const isReady = await this.healthService.isReady();
    return { ready: isReady };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  live() {
    return { live: this.healthService.isLive() };
  }
}
