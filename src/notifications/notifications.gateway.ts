import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuthUser } from '../helpers/AuthUser.type';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthUser;
  };
}

@WebSocketGateway({
  namespace: 'flutter/notifications',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const authUser = await this.authenticateSocket(client);
      client.data.user = authUser;
      const userRoom = `user:${authUser.userId.toString()}`;
      client.join(userRoom);
      this.logger.log(
        `[NotificationsGateway] Socket connected: ${client.id} for user ${authUser.userId} (${authUser.role})`,
      );
    } catch (error) {
      this.logger.warn(
        `[NotificationsGateway] Rejected socket ${client.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      client.emit('error', { message: 'Unauthorized notification socket' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(
      `[NotificationsGateway] Socket disconnected: ${client.id}`,
    );
  }

  sendToUser(userId: string, event: string, payload: any): boolean {
    const userRoom = `user:${userId}`;
    if (!this.server) {
      this.logger.warn('[NotificationsGateway] Server instance not ready');
      return false;
    }
    this.server.to(userRoom).emit(event, payload);
    this.logger.log(
      `[NotificationsGateway] Emitted ${event} to room ${userRoom}`,
    );
    return true;
  }

  private async authenticateSocket(client: Socket): Promise<AuthUser> {
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      email: string;
      role: any;
    }>(token);
    const user = await this.userModel.findById(payload.sub).exec();

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
    const socketAuth = client.handshake.auth as { token?: unknown } | undefined;
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

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.replace(/^Bearer\s+/i, '').trim();
    }

    return null;
  }
}
