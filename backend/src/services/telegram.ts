import fetch from 'node-fetch';
import logger from '../utils/logger';

interface TelegramMessage {
  botToken: string;
  chatId: string;
  message: string;
}

export async function sendTelegramMessage({ botToken, chatId, message }: TelegramMessage) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
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
