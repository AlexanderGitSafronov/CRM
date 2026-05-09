import logger from '../utils/logger';
import fetch from 'node-fetch';

interface MailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Provider abstraction. Wire RESEND_API_KEY (or SENDGRID_API_KEY) to enable real sending.
// Without keys, we just log to console — useful in dev.
export async function sendMail(params: MailParams): Promise<boolean> {
  const from = process.env.MAIL_FROM || 'CRM Pro <noreply@crmpro.app>';

  // Resend (https://resend.com)
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
      if (!r.ok) {
        const body = await r.text();
        logger.warn(`Resend failed (${r.status}): ${body}`);
        return false;
      }
      return true;
    } catch (err) {
      logger.error('Resend error:', err);
      return false;
    }
  }

  // SendGrid fallback (https://sendgrid.com)
  if (process.env.SENDGRID_API_KEY) {
    try {
      const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: from.replace(/.*<|>/g, '') || from, name: 'CRM Pro' },
          subject: params.subject,
          content: [
            ...(params.text ? [{ type: 'text/plain', value: params.text }] : []),
            { type: 'text/html', value: params.html },
          ],
        }),
      });
      if (!r.ok) {
        logger.warn(`SendGrid failed (${r.status})`);
        return false;
      }
      return true;
    } catch (err) {
      logger.error('SendGrid error:', err);
      return false;
    }
  }

  // Dev mode: log to console
  logger.info(`📧 [DEV MAIL] to=${params.to} | subject="${params.subject}"`);
  logger.info(`📧 [DEV MAIL] html=${params.html.slice(0, 200)}...`);
  return true;
}

const baseTemplate = (title: string, body: string) => `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:32px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#a855f7,#d946ef);"></div>
    </div>
    ${body}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">CRM Pro — Управління товарним бізнесом</p>
  </div>
</body>
</html>`;

export const renderVerificationEmail = ({ name, verifyUrl }: { name: string; verifyUrl: string }) =>
  baseTemplate('Підтвердження email', `
    <h1 style="font-size:22px;color:#111827;margin:0 0 16px;">Вітаємо у CRM Pro, ${escapeHtml(name)}!</h1>
    <p style="color:#374151;line-height:1.6;margin:0 0 24px;">
      Підтвердіть свою email-адресу, щоб активувати всі функції вашого воркспейсу.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6,#a855f7);color:white;text-decoration:none;border-radius:10px;font-weight:600;">
        Підтвердити email
      </a>
    </div>
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
      Або скопіюйте посилання:<br>
      <span style="color:#3b82f6;word-break:break-all;">${verifyUrl}</span>
    </p>
    <p style="color:#9ca3af;font-size:13px;margin-top:24px;">
      Посилання дійсне 24 години. Якщо ви не реєструвались — просто проігноруйте цей лист.
    </p>
  `);

export const renderPasswordResetEmail = ({ name, resetUrl }: { name: string; resetUrl: string }) =>
  baseTemplate('Відновлення паролю', `
    <h1 style="font-size:22px;color:#111827;margin:0 0 16px;">Привіт, ${escapeHtml(name)}</h1>
    <p style="color:#374151;line-height:1.6;margin:0 0 24px;">
      Ви запросили відновлення паролю. Натисніть на кнопку нижче, щоб задати новий пароль.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6,#a855f7);color:white;text-decoration:none;border-radius:10px;font-weight:600;">
        Скинути пароль
      </a>
    </div>
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
      Або скопіюйте посилання:<br>
      <span style="color:#3b82f6;word-break:break-all;">${resetUrl}</span>
    </p>
    <p style="color:#9ca3af;font-size:13px;margin-top:24px;">
      Посилання дійсне 1 годину. Якщо ви не запитували — просто проігноруйте цей лист.
    </p>
  `);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
