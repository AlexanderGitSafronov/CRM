import Link from 'next/link';

export const metadata = {
  title: 'Політика конфіденційності — CRM Pro',
  description: 'Політика конфіденційності сервісу CRM Pro.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-[#0b1220] dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Link href="/" className="text-sm text-blue-600 hover:underline">← На головну</Link>
        <h1 className="mt-4 text-3xl font-bold">Політика конфіденційності</h1>
        <p className="mt-2 text-sm text-gray-500">Оновлено: 2026</p>

        <div className="mt-8 space-y-6 leading-relaxed text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. Які дані ми збираємо</h2>
            <p>Для роботи облікового запису ми зберігаємо ваше ім’я, email та дані, які ви вносите в Сервіс (замовлення, клієнти, товари). Паролі зберігаються лише у вигляді хешу.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Як ми використовуємо дані</h2>
            <p>Дані використовуються виключно для надання функцій Сервісу. Ми не продаємо ваші дані третім сторонам.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3. Інтеграції</h2>
            <p>Якщо ви підключаєте інтеграції (Нова Пошта, Telegram, SMS тощо), відповідні дані передаються цим сервісам лише для виконання ваших операцій.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">4. Зберігання та безпека</h2>
            <p>Дані зберігаються на захищених серверах. Доступ до даних робочого простору мають лише авторизовані користувачі вашої організації.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">5. Ваші права</h2>
            <p>Ви можете запросити видалення свого облікового запису та пов’язаних даних, звернувшись до адміністрації робочого простору.</p>
          </section>
          <p className="text-sm text-gray-500">
            Документ є базовим шаблоном і має бути погоджений з юристом перед комерційним запуском.
          </p>
        </div>
      </div>
    </main>
  );
}
