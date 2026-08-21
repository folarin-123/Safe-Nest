import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import * as ejs from 'ejs';
import * as path from 'path';
import {
  EMAIL_TEMPLATE_SUBJECTS,
  EmailTemplateDataMap,
  EmailTemplateName,
} from './email-template.types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromAddress: string;
  private readonly templatesDir = path.join(__dirname, 'templates');

  constructor(private readonly configService: ConfigService) {
    const apiKey = configService.getOrThrow<string>('SENDGRID_API_KEY');
    sgMail.setApiKey(apiKey);

    this.fromAddress = configService.get<string>('EMAIL_FROM') || 'folarinsamuel133@gmail.com';
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
      const msg = {
        to: options.to,
        from: this.fromAddress,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };
      this.logger.log(`Sending email from ${this.fromAddress} to ${options.to}`);
      await sgMail.send(msg);
      this.logger.log(`Email sent to ${options.to}`);
      return { messageId: 'sendgrid-web-api' };
    } catch (error) {
      this.logger.error('Unable to send email', error as Error);
      const errorObj = error as any;
      if (errorObj.response) {
        this.logger.error('SendGrid response body:', JSON.stringify(errorObj.response.body, null, 2));
      }
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