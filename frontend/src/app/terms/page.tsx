import Link from 'next/link';

export const metadata = {
  title: 'Умови використання — CRM Pro',
  description: 'Умови використання сервісу CRM Pro.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-[#0b1220] dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Link href="/" className="text-sm text-blue-600 hover:underline">← На головну</Link>
        <h1 className="mt-4 text-3xl font-bold">Умови використання</h1>
        <p className="mt-2 text-sm text-gray-500">Оновлено: 2026</p>

        <div className="mt-8 space-y-6 leading-relaxed text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. Загальні положення</h2>
            <p>Використовуючи CRM Pro («Сервіс»), ви погоджуєтесь із цими Умовами. Сервіс надається «як є» для обліку замовлень, клієнтів і товарів вашого бізнесу.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Обліковий запис</h2>
            <p>Ви відповідаєте за збереження доступу до свого облікового запису та за дії, вчинені під ним. Кожна реєстрація створює окремий ізольований робочий простір.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3. Дані та відповідальність</h2>
            <p>Ви зберігаєте права на дані, які вносите. Ви відповідаєте за законність обробки персональних даних ваших клієнтів згідно з чинним законодавством.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">4. Обмеження</h2>
            <p>Заборонено використовувати Сервіс для незаконної діяльності, розсилки спаму чи спроб порушити його роботу.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">5. Контакти</h2>
            <p>З питань щодо цих Умов звертайтесь до адміністрації вашого робочого простору.</p>
          </section>
          <p className="text-sm text-gray-500">
            Документ є базовим шаблоном і має бути погоджений з юристом перед комерційним запуском.
          </p>
        </div>
      </div>
    </main>
  );
}
