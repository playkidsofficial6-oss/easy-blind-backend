import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Check API and MongoDB health' })
  @ApiOkResponse({ description: 'Health status returned successfully.' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        readyState: this.connection.readyState,
        connected: Number(this.connection.readyState) === 1,
        name: this.connection.name,
      },
    };
  }
}
