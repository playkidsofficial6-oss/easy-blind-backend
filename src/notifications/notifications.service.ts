import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { App, initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { NotificationsGateway } from './notifications.gateway';
import { User, UserDocument } from '../users/schemas/user.schema';

export interface JobAssignmentNotificationParams {
  targetUserId: string | mongoose.Types.ObjectId;
  jobId: string;
  jobMongoId: string;
  customerName?: string;
  address?: string;
  role: 'Salesman' | 'Fitter';
  scheduledAt?: Date | string;
  assignedByName?: string;
}

export interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  jobId: string;
  jobMongoId: string;
  customerName: string;
  address: string;
  role: string;
  scheduledAt?: string;
  timestamp: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: App | null = null;

  constructor(
    private readonly notificationsGateway: NotificationsGateway,
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    this.initFirebase();
  }

  private initFirebase(): void {
    try {
      const apps = getApps();
      if (apps.length > 0) {
        this.firebaseApp = getApp();
        this.logger.log('[Firebase] Using existing Firebase Admin app');
        return;
      }

      const serviceAccountJson =
        this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT') ||
        process.env.FIREBASE_SERVICE_ACCOUNT;

      const projectId =
        this.configService.get<string>('FIREBASE_PROJECT_ID') ||
        process.env.FIREBASE_PROJECT_ID;
      const clientEmail =
        this.configService.get<string>('FIREBASE_CLIENT_EMAIL') ||
        process.env.FIREBASE_CLIENT_EMAIL;
      const privateKeyRaw =
        this.configService.get<string>('FIREBASE_PRIVATE_KEY') ||
        process.env.FIREBASE_PRIVATE_KEY;

      if (serviceAccountJson) {
        let credentialObj: any;
        const resolvedPath = path.resolve(process.cwd(), serviceAccountJson);
        if (fs.existsSync(resolvedPath)) {
          credentialObj = cert(resolvedPath);
        } else if (fs.existsSync(serviceAccountJson)) {
          credentialObj = cert(serviceAccountJson);
        } else {
          try {
            const parsedConfig = JSON.parse(serviceAccountJson);
            credentialObj = cert(parsedConfig);
          } catch {
            credentialObj = cert(serviceAccountJson);
          }
        }
        this.firebaseApp = initializeApp({
          credential: credentialObj,
        });
        this.logger.log('[Firebase] Initialized with service account JSON');
      } else if (projectId && clientEmail && privateKeyRaw) {
        const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
        this.firebaseApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.logger.log(
          `[Firebase] Initialized with projectId: ${projectId} and clientEmail: ${clientEmail}`,
        );
      } else {
        this.logger.log(
          '[Firebase] No Firebase credentials provided in env. Real-time WebSocket notifications will operate normally.',
        );
      }
    } catch (error) {
      this.logger.error(
        `[Firebase] Failed to initialize Firebase Admin SDK: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  async notifyJobAssigned(
    params: JobAssignmentNotificationParams,
  ): Promise<{ socketDelivered: boolean; fcmCount: number }> {
    const targetUserIdStr = params.targetUserId.toString();
    const customer = params.customerName || 'Customer';
    const address = params.address || 'Address provided in job';
    const displayJobId = params.jobId || params.jobMongoId;

    const title = `New Job Assigned • #${displayJobId}`;
    const body = `You have been assigned to job #${displayJobId} for ${customer} at ${address}.`;

    const payload: NotificationPayload = {
      type: 'JOB_ASSIGNED',
      title,
      body,
      jobId: displayJobId,
      jobMongoId: params.jobMongoId,
      customerName: customer,
      address,
      role: params.role,
      scheduledAt: params.scheduledAt
        ? new Date(params.scheduledAt).toISOString()
        : undefined,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(
      `[NotificationsService] Notifying user ${targetUserIdStr} (${params.role}) about Job #${displayJobId}`,
    );

    // 1. Deliver via Real-time Socket.IO
    let socketDelivered = false;
    try {
      socketDelivered = this.notificationsGateway.sendToUser(
        targetUserIdStr,
        'job:assigned',
        payload,
      );
      this.notificationsGateway.sendToUser(
        targetUserIdStr,
        'notification',
        payload,
      );
    } catch (socketError) {
      this.logger.error(
        `[NotificationsService] Socket delivery failed for ${targetUserIdStr}:`,
        socketError,
      );
    }

    // 2. Deliver via Firebase Cloud Messaging (FCM)
    let fcmCount = 0;
    try {
      const user = await this.userModel
        .findById(targetUserIdStr)
        .select('+fcmTokens')
        .exec();

      if (user && user.fcmTokens && user.fcmTokens.length > 0) {
        fcmCount = await this.sendFcmPush(user, title, body, payload);
      } else {
        this.logger.debug(
          `[NotificationsService] User ${targetUserIdStr} has no registered FCM tokens`,
        );
      }
    } catch (fcmError) {
      this.logger.error(
        `[NotificationsService] FCM dispatch failed for ${targetUserIdStr}:`,
        fcmError,
      );
    }

    return { socketDelivered, fcmCount };
  }

  private async sendFcmPush(
    user: UserDocument,
    title: string,
    body: string,
    payload: NotificationPayload,
  ): Promise<number> {
    if (!this.firebaseApp) {
      this.logger.debug(
        '[Firebase] Skipped FCM push: Firebase Admin not configured',
      );
      return 0;
    }

    const tokens = user.fcmTokens?.filter(
      (t) => typeof t === 'string' && t.trim().length > 0,
    ) || [];

    if (tokens.length === 0) return 0;

    const messaging = getMessaging(this.firebaseApp);
    const deadTokens: string[] = [];
    let successCount = 0;

    const message: MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        type: payload.type,
        title: payload.title,
        body: payload.body,
        jobId: payload.jobId,
        jobMongoId: payload.jobMongoId,
        customerName: payload.customerName,
        address: payload.address,
        role: payload.role,
        scheduledAt: payload.scheduledAt || '',
        timestamp: payload.timestamp,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'job_assignments_channel',
          priority: 'high',
          sound: 'default',
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
            contentAvailable: true,
          },
        },
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      this.logger.log(
        `[FCM] Sent to ${tokens.length} devices: ${response.successCount} succeeded, ${response.failureCount} failed`,
      );
      successCount = response.successCount;

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            deadTokens.push(tokens[idx]);
          }
        }
      });

      // Prune dead tokens if any
      if (deadTokens.length > 0) {
        await this.userModel.updateOne(
          { _id: user._id },
          { $pullAll: { fcmTokens: deadTokens } },
        );
        this.logger.log(
          `[FCM] Pruned ${deadTokens.length} dead tokens for user ${user._id}`,
        );
      }
    } catch (err) {
      this.logger.error('[FCM] Error sending multicast push:', err);
    }

    return successCount;
  }
}
