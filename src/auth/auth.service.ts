import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-user.interface';
import { UserResponse, UsersService } from '../users/users.service';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Model } from 'mongoose';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  user: UserResponse;
}

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    this.refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const user = await this.usersService.create(registerDto);
    return this.buildAuthResponse(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmailWithPassword(
      loginDto.email,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      checkedIn: user.checkedIn,
      phoneNumber: user?.phoneNumber || '-',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async refreshTokens(currentRefreshToken: string): Promise<AuthResponse> {
    // 1. Verify the refresh token signature & expiry
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string }>(
        currentRefreshToken,
        { secret: this.refreshSecret },
      );
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }

    // 2. Look up the user and their stored hashed refresh token
    const user = await this.userModel
      .findById(payload.sub)
      .select('+refreshToken')
      .exec();

    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Access denied');
    }

    // 3. Compare the incoming refresh token with the stored hash
    const isMatch = await bcrypt.compare(
      currentRefreshToken,
      user.refreshToken,
    );

    if (!isMatch) {
      // Possible token reuse attack — invalidate all refresh tokens
      await this.userModel
        .findByIdAndUpdate(payload.sub, { $unset: { refreshToken: 1 } })
        .exec();
      throw new ForbiddenException('Access denied — token reuse detected');
    }

    // 4. Issue a fresh token pair
    const userResponse = await this.usersService.findById(payload.sub);
    if (!userResponse) {
      throw new ForbiddenException('User not found');
    }

    return this.buildAuthResponse(userResponse);
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        checkedIn: false,
        $unset: { refreshToken: 1 },
      })
      .exec();
    return { message: 'Logged out successfully' };
  }

  // ─── Private helpers ───────────────────────────────────────────

  private async buildAuthResponse(user: UserResponse): Promise<AuthResponse> {
    const accessPayload: JwtPayload = {
      sub: user._id,
      email: user.email,
      role: user.role,
    };

    // Access token — short-lived, contains full user info
    const accessToken = await this.jwtService.signAsync(accessPayload);

    // Refresh token — long-lived, contains only the user id
    const refreshToken = await this.jwtService.signAsync(
      { sub: user._id },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn as SignOptions['expiresIn'],
      },
    );

    // Hash the refresh token and persist it on the user document
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userModel
      .findByIdAndUpdate(user._id, { refreshToken: hashedRefreshToken })
      .exec();

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      user,
    };
  }
}
