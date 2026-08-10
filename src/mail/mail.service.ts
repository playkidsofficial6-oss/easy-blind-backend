import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailRecipient {
  email: string;
  name?: string;
}

export interface SendMailOptions {
  to: SendMailRecipient[];
  subject: string;
  htmlbody: string;
  fromAddress?: string;
  fromName?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) { }

  /**
   * Sends transactional email using ZeptoMail REST API
   */
  async sendMail(options: SendMailOptions): Promise<boolean> {
    const url =
      this.configService.get<string>('ZEPTOMAIL_URL') ||
      'https://api.zeptomail.in/v1.1/email';
    const token =
      this.configService.get<string>('ZEPTOMAIL_TOKEN') ||
      'Zoho-enczapikey PHtE6r0ERr26iTYo9UJR5aC/EpShM4Mq/bg2LgIVt9lAX6BXFk1S/tsulT61/h57XaYUHfWSwYpu4rKZ5ePTcGq/NDtMXGqyqK3sx/VYSPOZsbq6x00auFQddkfdXYHvdN9r1yzWvdzbNA==';

    if (!token) {
      this.logger.warn('ZeptoMail API Token is missing. Skipping email.');
      return false;
    }

    const fromAddress =
      options.fromAddress ||
      this.configService.get<string>('ZEPTOMAIL_FROM_ADDRESS') ||
      'noreply@measurepro.co';
    const fromName =
      options.fromName ||
      this.configService.get<string>('ZEPTOMAIL_FROM_NAME') ||
      'noreply';

    const bodyPayload = {
      from: {
        address: fromAddress,
        name: fromName,
      },
      to: options.to.map((recipient) => ({
        email_address: {
          address: recipient.email,
          name: recipient.name || recipient.email,
        },
      })),
      subject: options.subject,
      htmlbody: options.htmlbody,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      const responseData = (await response.json()) as Record<string, unknown>;
      if (response.ok || response.status === 201) {
        this.logger.log(
          `ZeptoMail sent successfully to: ${options.to.map((t) => t.email).join(', ')} [Request ID: ${String(responseData.request_id || '')}]`,
        );
        return true;
      } else {
        this.logger.error(
          `ZeptoMail returned status ${response.status}: ${JSON.stringify(responseData)}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error('Error sending email via ZeptoMail API:', error);
      return false;
    }
  }

  /**
   * Sends formatted HTML password reset email template via ZeptoMail
   */
  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<boolean> {
    const frontendUrl =
      this.configService.get<string>('CORS_ORIGIN') || 'https://measurepro.co';
    const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const htmlbody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your MeasurePro Password</title>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8fafc; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px; background-color:#ffffff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color:#0f172a; padding:36px 32px; text-align:center;">
              <div style="display:inline-block; width:52px; height:52px; background-color:#d97706; color:#ffffff; font-size:24px; font-weight:700; line-height:52px; border-radius:14px; margin-bottom:12px; box-shadow:0 4px 12px rgba(217,119,6,0.4);">EB</div>
              <h1 style="color:#ffffff; font-size:24px; font-weight:700; margin:0; tracking-tight: -0.02em;">Easy Blinds &bull; MeasurePro</h1>
              <p style="color:#f59e0b; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.18em; margin:8px 0 0 0;">Password Reset Request</p>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding:36px 32px;">
              <h2 style="color:#0f172a; font-size:20px; font-weight:700; margin:0 0 16px 0;">Hello ${name || 'Valued User'},</h2>
              <p style="color:#475569; font-size:15px; line-height:1.6; margin:0 0 20px 0;">
                We received a request to reset the password for your MeasurePro account associated with <strong style="color:#0f172a;">${email}</strong>.
              </p>
              <p style="color:#475569; font-size:15px; line-height:1.6; margin:0 0 28px 0;">
                Click the button below to open the password reset page and set your new password:
              </p>
              
              <!-- CTA Button -->
              <div style="text-align:center; margin:32px 0;">
                <a href="${resetLink}" target="_blank" style="background-color:#d97706; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; padding:15px 36px; border-radius:12px; display:inline-block; box-shadow:0 4px 14px rgba(217,119,6,0.35);">
                  Reset My Password &rarr;
                </a>
              </div>

              <!-- Direct Link Box -->
              <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:28px; word-break:break-all;">
                <p style="color:#64748b; font-size:12px; font-weight:600; margin:0 0 6px 0; text-transform:uppercase; letter-spacing:0.05em;">Direct Link Option</p>
                <p style="color:#64748b; font-size:12px; margin:0 0 8px 0;">If the button above does not open directly, copy and paste this link into your web browser:</p>
                <a href="${resetLink}" style="color:#d97706; font-size:12px; text-decoration:underline; font-family:monospace;">${resetLink}</a>
              </div>

              <!-- Notice Box -->
              <div style="border-left:4px solid #f59e0b; background-color:#fffbeb; padding:14px 18px; border-radius:8px; margin-bottom:28px;">
                <p style="color:#b45309; font-size:13px; margin:0; line-height:1.5;">
                  <strong>Important Security Notice:</strong> This password reset link will expire in 24 hours. If you did not request a password reset, no action is required and your password remains unchanged.
                </p>
              </div>

              <p style="color:#475569; font-size:14px; margin:0;">
                Best regards,<br>
                <strong style="color:#0f172a;">The MeasurePro Support Team</strong>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc; border-top:1px solid #f1f5f9; padding:24px 32px; text-align:center;">
              <p style="color:#94a3b8; font-size:12px; margin:0 0 6px 0;">MeasurePro Systems &bull; Easy Blinds Field Operations</p>
              <p style="color:#cbd5e1; font-size:11px; margin:0;">&copy; ${new Date().getFullYear()} MeasurePro. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.sendMail({
      to: [{ email, name }],
      subject: 'Reset Your Password - MeasurePro',
      htmlbody,
    });
  }
}
