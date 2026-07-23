import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthUser } from 'src/helpers/AuthUser.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users for admin-ready user management' })
  @ApiOkResponse({ description: 'Users returned successfully.' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read a single user by MongoDB id' })
  @ApiOkResponse({ description: 'User returned successfully.' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset link for forgotten password' })
  @ApiOkResponse({ description: 'Password reset request processed successfully.' })
  forgetPassword(@Body() dto: PasswordResetRequestDto) {
    return this.usersService.forgetPassword(dto);
  }

  @Post('reset-password/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password using token' })
  @ApiOkResponse({ description: 'Password reset successfully.' })
  resetPassword(@Param('token') token: string, @Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(token, dto);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiOkResponse({ description: 'Password changed successfully.' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Request() { user }: { user: AuthUser },
  ) {
    return this.usersService.changePassword(user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing user profile' })
  @ApiOkResponse({ description: 'User updated successfully.' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post('checkin')
  @Patch('checkin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check in user' })
  @ApiOkResponse({ description: 'Checked in successfully.' })
  checkIn(
    @Request() { user }: { user: AuthUser },
    @Body() body?: { userId?: string },
  ) {
    return this.usersService.checkIn(user.userId, body?.userId);
  }

  @Post('checkout')
  @Patch('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check out user' })
  @ApiOkResponse({ description: 'Checked out successfully.' })
  checkOut(
    @Request() { user }: { user: AuthUser },
    @Body() body?: { userId?: string },
  ) {
    return this.usersService.checkOut(user.userId, body?.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an existing user' })
  @ApiOkResponse({ description: 'User deleted successfully.' })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.remove(id);
  }
}
