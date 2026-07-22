import { Controller, ForbiddenException, Get, Request, UseGuards } from '@nestjs/common';
import { SalesManService } from './sales-man.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/helpers/AuthUser.type';
import { UserRole } from 'src/users/schemas/user.schema';


@UseGuards(JwtAuthGuard)
@Controller('flutter/sales-man')
export class SalesManController {
  constructor(private readonly salesManService: SalesManService) { }

  @Get("home")
  async home(@Request() { user }: { user: AuthUser }): Promise<any> {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route")
    }
    return await this.salesManService.home(user.userId);
  }
}
