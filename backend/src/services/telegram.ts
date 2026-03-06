import fetch from 'node-fetch';
import logger from '../utils/logger';

interface TelegramMessage {
  botToken: string;
  chatId: string;
  message: string;
  inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>;
}

export async function sendTelegramMessage({ botToken, chatId, message, inlineKeyboard }: TelegramMessage) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    };
    if (inlineKeyboard) {
      body.reply_markup = { inline_keyboard: inlineKeyboard };
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json() as { ok: boolean; description?: string };
    if (!data.ok) {
      logger.warn('Telegram message failed:', data.description);
      return false;
    }
    return true;
  } catch (error) {
    logger.error('Telegram send error:', error);
    return false;
  }
}

export async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch { /* ignore */ }
}

export function formatOrderNotification(order: {
  orderNum: number;
  customer: { name: string; phone: string };
  total: number;
  source: string;
  items: Array<{ name: string; quantity: number; price: number }>;
}) {
  const itemsList = order.items
    .map((item) => `  • ${item.name} x${item.quantity} — ${item.price.toLocaleString('uk-UA')} грн`)
    .join('\n');

  return `🛒 <b>Новый заказ #${order.orderNum}</b>

👤 Клиент: ${order.customer.name}
📱 Телефон: ${order.customer.phone}
📦 Товары:
${itemsList}
💰 Сумма: <b>${order.total.toLocaleString('uk-UA')} грн</b>
📡 Источник: ${order.source}`;
}
