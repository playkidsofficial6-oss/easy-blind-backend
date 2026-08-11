import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { LiveLocationService } from './live-location.service';
import { TrackLiveLocationDto } from './dto/trackLiveLocation.dto';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthUser } from '../../helpers/AuthUser.type';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthUser;
  };
}

@WebSocketGateway({
  namespace: 'flutter/live-location',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class LiveLocationGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveLocationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly liveLocationService: LiveLocationService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const authUser = await this.authenticateSocket(client);
      client.data.user = authUser;
      this.logger.log(`Flutter LiveLocation socket connected: ${authUser.userId}`);
    } catch (error) {
      this.logger.warn(
        `Rejected flutter live-location socket ${client.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      client.emit('error', { message: 'Unauthorized live-location socket' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('trackLiveLocation')
  async handleTrackLiveLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: TrackLiveLocationDto | string,
  ) {
    const authUser = client.data.user;
    if (!authUser) {
      throw new WsException('Unauthorized live-location socket');
    }

    let parsedDto: TrackLiveLocationDto = dto as TrackLiveLocationDto;
    if (typeof dto === 'string') {
      try {
        parsedDto = JSON.parse(dto);
      } catch (e) {
        throw new WsException('Invalid JSON payload');
      }
    }

    const res = await this.liveLocationService.trackLiveLocation(authUser, parsedDto);
    if (res?.data) {
      this.server.emit('location:updated', res.data);
    }
    return res;
  }

  @SubscribeMessage('track-live-location')
  async handleTrackLiveLocationKebab(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: TrackLiveLocationDto | string,
  ) {
    const authUser = client.data.user;
    if (!authUser) {
      throw new WsException('Unauthorized live-location socket');
    }

    let parsedDto: TrackLiveLocationDto = dto as TrackLiveLocationDto;
    if (typeof dto === 'string') {
      try {
        parsedDto = JSON.parse(dto);
      } catch (e) {
        throw new WsException('Invalid JSON payload');
      }
    }

    const res = await this.liveLocationService.trackLiveLocation(authUser, parsedDto);
    if (res?.data) {
      this.server.emit('location:updated', res.data);
    }
    return res;
  }

  private async authenticateSocket(client: Socket): Promise<AuthUser> {
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    const payload = await this.jwtService.verifyAsync<{ sub: string; email: string; role: any }>(token);
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
