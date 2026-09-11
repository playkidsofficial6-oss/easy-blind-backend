import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { AuthUser } from '../helpers/AuthUser.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FcmTokenDto } from './dto/fcm-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './schemas/user.schema';

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

  @Get('fitters')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List fitter users merged with fitter profiles' })
  @ApiOkResponse({ description: 'Fitters returned successfully.' })
  findFitters() {
    return this.usersService.findFitters();
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
  @ApiOperation({
    summary: 'Request a password reset link for forgotten password',
  })
  @ApiOkResponse({
    description: 'Password reset request processed successfully.',
  })
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
    @Request() { user }: { user: AuthUser },
  ) {
    const allowedRoles = [
      UserRole.SalesManager,
      UserRole.Admin,
      UserRole.Owner,
    ];
    const isSelf = user.userId.toString() === id;
    const isAuthorizedRole = allowedRoles.includes(user.role);

    if (!isSelf && !isAuthorizedRole) {
      throw new ForbiddenException(
        'Access denied. Insufficient permissions to edit this user.',
      );
    }

    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SalesManager, UserRole.Admin, UserRole.Owner)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a user by id' })
  @ApiOkResponse({ description: 'User deleted successfully.' })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.softDelete(id);
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

  @Post('fcm-token')
  @Patch('fcm-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register/update device FCM token for push notifications' })
  @ApiOkResponse({ description: 'FCM token registered successfully.' })
  updateFcmToken(
    @Request() { user }: { user: AuthUser },
    @Body() dto: FcmTokenDto,
  ) {
    return this.usersService.updateFcmToken(user.userId, dto.token);
  }

  @Delete('fcm-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove device FCM token on logout' })
  @ApiOkResponse({ description: 'FCM token removed successfully.' })
  removeFcmToken(
    @Request() { user }: { user: AuthUser },
    @Body() dto: FcmTokenDto,
  ) {
    return this.usersService.removeFcmToken(user.userId, dto.token);
  }
}

