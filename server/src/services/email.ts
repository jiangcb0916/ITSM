import nodemailer from 'nodemailer';
import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (!config.smtp.host || !config.smtp.user) {
    console.warn('SMTP not configured; email notifications disabled.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const trans = getTransporter();
  if (!trans) return false;
  try {
    await trans.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
    });
    return true;
  } catch (e) {
    console.error('Send mail error:', e);
    return false;
  }
}

export function notifyTicketUpdate(
  toEmail: string,
  ticketId: number,
  title: string,
  message: string
): Promise<boolean> {
  const html = `
    <p>工单 #${ticketId}《${title}》有更新：</p>
    <p>${message}</p>
    <p>请登录系统查看。</p>
  `;
  return sendMail(toEmail, `工单 #${ticketId} 更新通知`, html);
}
