import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = configService.getOrThrow<string>('SMTP_HOST');
    const port = Number(configService.getOrThrow<string>('SMTP_PORT'));
    const user = configService.getOrThrow<string>('SMTP_USER');
    const pass = configService.getOrThrow<string>('SMTP_PASS');

    this.fromAddress =
      configService.get<string>('EMAIL_FROM') ?? `no-reply@${new URL(`https://${host}`).hostname}`;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    try {
      const result = await this.transporter.sendMail({
        from: this.fromAddress,
        ...options,
      });

      this.logger.log(`Email sent to ${options.to} (messageId=${result.messageId})`);
      return result;
    } catch (error) {
      this.logger.error('Unable to send email', error as Error);
      throw new InternalServerErrorException('Unable to send email at this time.');
    }
  }
}
