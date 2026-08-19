<<<<<<< HEAD
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
      configService.get<string>('EMAIL_FROM') ?? this.getDefaultFromAddress(host);

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

  private getDefaultFromAddress(host: string) {
    try {
      return `no-reply@${new URL(`https://${host}`).hostname}`;
    } catch {
      return 'no-reply@example.com';
    }
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
=======
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ejs from 'ejs';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import type { Transporter } from 'nodemailer';
import {
  EMAIL_TEMPLATE_SUBJECTS,
  EmailTemplateDataMap,
  EmailTemplateName,
} from './email-template.types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly templatesDir = path.join(__dirname, 'templates');

  constructor(private readonly configService: ConfigService) {
    const host = configService.getOrThrow<string>('SMTP_HOST');
    const port = Number(configService.getOrThrow<string>('SMTP_PORT'));
    const user = configService.getOrThrow<string>('SMTP_USER');
    const pass = configService.getOrThrow<string>('SMTP_PASS');

    this.fromAddress =
      configService.get<string>('EMAIL_FROM') ?? this.getDefaultFromAddress(host);

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

  private getDefaultFromAddress(host: string) {
    try {
      return `no-reply@${new URL(`https://${host}`).hostname}`;
    } catch {
      return 'no-reply@example.com';
    }
  }

  async renderTemplate<T extends EmailTemplateName>(
    templateName: T,
    data: EmailTemplateDataMap[T],
  ): Promise<{ html: string; text: string }> {
    const bodyPath = path.join(this.templatesDir, `${templateName}.ejs`);
    const textPath = path.join(this.templatesDir, `${templateName}.text.ejs`);
    const layoutPath = path.join(this.templatesDir, 'layouts', 'base.ejs');

    try {
      const body = await ejs.renderFile(bodyPath, data);
      const html = await ejs.renderFile(layoutPath, {
        title: this.resolveSubject(templateName, data),
        body,
      });

      let text: string;
      try {
        text = await ejs.renderFile(textPath, data);
      } catch {
        text = this.stripHtml(html);
      }

      return { html, text: text.trim() };
    } catch (error) {
      this.logger.error(
        `Failed to render email template "${templateName}"`,
        error as Error,
      );
      throw new InternalServerErrorException(
        'Unable to prepare email content at this time.',
      );
    }
  }

  async sendTemplate<T extends EmailTemplateName>(
    to: string,
    templateName: T,
    data: EmailTemplateDataMap[T],
    subjectOverride?: string,
  ) {
    const { html, text } = await this.renderTemplate(templateName, data);
    const subject =
      subjectOverride ?? this.resolveSubject(templateName, data);

    return this.sendMail({ to, subject, text, html });
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

  private resolveSubject<T extends EmailTemplateName>(
    templateName: T,
    data: EmailTemplateDataMap[T],
  ): string {
    const subject = EMAIL_TEMPLATE_SUBJECTS[templateName];
    return typeof subject === 'function' ? subject(data) : subject;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
>>>>>>> origin/main
