import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthenticatedUser } from './interfaces/jwt-user.interface';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

interface AuthenticatedRequest {
  user: JwtAuthenticatedUser;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) { }

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user and return JWT access + refresh tokens',
  })
  @ApiCreatedResponse({ description: 'User registered successfully.' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email and password and return JWT access + refresh tokens',
  })
  @ApiOkResponse({ description: 'User logged in successfully.' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a valid refresh token for a new access + refresh token pair',
  })
  @ApiOkResponse({ description: 'Tokens refreshed successfully.' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate the refresh token and log out' })
  @ApiOkResponse({ description: 'Logged out successfully.' })
  logout(@Req() req: AuthenticatedRequest) {
    return this.authService.logout(req.user.userId);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read the authenticated user profile' })
  @ApiOkResponse({ description: 'Profile returned successfully.' })
  profile(@Req() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.userId);
  }




}
