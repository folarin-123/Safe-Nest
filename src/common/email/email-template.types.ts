export interface WelcomeTemplateData {
  fullName: string;
  supportUrl?: string;
}

export interface ReminderTemplateData {
  firstName: string;
  goals: Array<{ name: string; requiredAmount: string }>;
}

export interface ResetPasswordTemplateData {
  fullName: string;
  resetUrl: string;
}

export type EmailTemplateName = 'welcome' | 'reminder' | 'reset-password';

export type EmailTemplateDataMap = {
  welcome: WelcomeTemplateData;
  reminder: ReminderTemplateData;
  'reset-password': ResetPasswordTemplateData;
};

export const EMAIL_TEMPLATE_SUBJECTS: {
  [K in EmailTemplateName]: string | ((data: EmailTemplateDataMap[K]) => string);
} = {
  welcome: 'Welcome to SafeNest',
  reminder: () => 'Your SafeNest savings reminder',
  'reset-password': 'Reset your SafeNest password',
};
