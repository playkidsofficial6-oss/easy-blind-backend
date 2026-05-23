import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Namespace, Server, Socket } from 'socket.io';
import {
  JwtAuthenticatedUser,
  JwtPayload,
} from '../auth/interfaces/jwt-user.interface';
import { UserRole } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { UpdateLiveLocationDto } from './dto/update-live-location.dto';
import {
  ApiResponse,
  LiveLocationResponse,
  LiveLocationService,
} from './live-location.service';

type AuthenticatedSocket = Socket & {
  data: {
    user?: JwtAuthenticatedUser;
  };
};

interface LiveLocationSocketEvent {
  userId: string;
  role: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  isOnline: boolean;
  lastUpdatedAt: Date;
}

interface LiveLocationPresenceEvent {
  userId: string;
  role: UserRole;
  isOnline: boolean;
  lastUpdatedAt: Date;
}

interface SocketHandshakeAuth {
  token?: unknown;
}

const MANAGER_ROOM = 'live-location:managers';

@WebSocketGateway({
  namespace: 'live-location',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class LiveLocationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Namespace;

  private readonly logger = new Logger(LiveLocationGateway.name);
  private readonly activeSocketsByUserId = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly liveLocationService: LiveLocationService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const authUser = await this.authenticateSocket(client);
      client.data.user = authUser;

      this.disconnectDuplicateSocket(authUser.userId, client.id);
      this.activeSocketsByUserId.set(authUser.userId, client.id);
      await client.join(`user:${authUser.userId}`);

      if (this.canReceiveAll(authUser.role)) {
        await client.join(MANAGER_ROOM);
      }

      if (this.canShareLocation(authUser.role)) {
        await this.liveLocationService.setOnlineStatus(authUser, true);
        this.broadcastUserPresence(authUser, true);
      }
    } catch (error) {
      this.logger.warn(
        `Rejected live-location socket ${client.id}: ${this.getErrorMessage(error)}`,
      );
      client.emit('error', { message: 'Unauthorized live-location socket' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const authUser = client.data.user;

    if (!authUser) {
      return;
    }

    const activeSocketId = this.activeSocketsByUserId.get(authUser.userId);

    if (activeSocketId !== client.id) {
      return;
    }

    this.activeSocketsByUserId.delete(authUser.userId);

    if (this.canShareLocation(authUser.role)) {
      try {
        await this.liveLocationService.setOnlineStatus(authUser, false);
        this.broadcastUserPresence(authUser, false);
      } catch (error) {
        this.logger.error(
          `Failed to mark ${authUser.userId} offline: ${this.getErrorMessage(error)}`,
        );
      }
    }
  }

  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() updateLiveLocationDto: UpdateLiveLocationDto,
  ): Promise<ApiResponse<LiveLocationResponse>> {
    const authUser = client.data.user;

    if (!authUser) {
      throw new WsException('Unauthorized live-location socket');
    }

    const response = await this.liveLocationService.updateLocation(
      authUser,
      updateLiveLocationDto,
    );

    this.broadcastLocationUpdated(response.data);

    return response;
  }

  broadcastLocationUpdated(location: LiveLocationResponse): void {
    this.server.to(MANAGER_ROOM).emit('location:updated', {
      userId: location.userId,
      role: location.role,
      location: location.location,
      latitude: location.location.coordinates[1],
      longitude: location.location.coordinates[0],
      accuracy: location.accuracy,
      speed: location.speed,
      heading: location.heading,
      isOnline: location.isOnline,
      lastUpdatedAt: location.lastUpdatedAt,
    } satisfies LiveLocationSocketEvent);
  }

  private broadcastUserPresence(
    authUser: JwtAuthenticatedUser,
    isOnline: boolean,
  ): void {
    this.server
      .to(MANAGER_ROOM)
      .emit(isOnline ? 'user:online' : 'user:offline', {
        userId: authUser.userId,
        role: authUser.role,
        isOnline,
        lastUpdatedAt: new Date(),
      } satisfies LiveLocationPresenceEvent);
  }

  private async authenticateSocket(
    client: Socket,
  ): Promise<JwtAuthenticatedUser> {
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new WsException('Invalid authentication token');
    }

    return {
      userId: user._id,
      email: user.email,
      role: user.role,
    };
  }

  private extractToken(client: Socket): string | null {
    const socketAuth = client.handshake.auth as SocketHandshakeAuth | undefined;
    const authToken = socketAuth?.token;

    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '').trim();
    }

    const authorization = client.handshake.headers.authorization;

    if (
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ')
    ) {
      return authorization.slice(7).trim();
    }

    return null;
  }

  private disconnectDuplicateSocket(
    userId: string,
    currentSocketId: string,
  ): void {
    const existingSocketId = this.activeSocketsByUserId.get(userId);

    if (!existingSocketId || existingSocketId === currentSocketId) {
      return;
    }

    const existingSocket = this.server.sockets.get(existingSocketId);

    if (existingSocket) {
      existingSocket.emit('error', {
        message: 'Another live-location socket connected for this user',
      });
      existingSocket.disconnect(true);
    }
  }

  private canReceiveAll(role: UserRole): boolean {
    return [UserRole.Owner, UserRole.SalesManager, UserRole.Admin].includes(role);
  }

  private canShareLocation(role: UserRole): boolean {
    return [UserRole.Salesman, UserRole.Fitter, UserRole.Field].includes(role);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
