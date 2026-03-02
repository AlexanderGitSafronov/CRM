<?php
session_start();
$period_cookie = 2592000; // 30 дней

if (!empty($_GET)) {
    $utm_keys = ['utm_source', 'utm_medium', 'utm_term', 'utm_content', 'utm_campaign'];
    foreach ($utm_keys as $key) {
        if (isset($_GET[$key])) {
            setcookie($key, $_GET[$key], time() + $period_cookie, '/');
            $_SESSION[$key] = $_GET[$key];
        }
    }
}

// Заполняем из сессии или куки
$utm = [];
foreach (['utm_source', 'utm_medium', 'utm_term', 'utm_content', 'utm_campaign'] as $key) {
    $utm[$key] = $_SESSION[$key] ?? $_COOKIE[$key] ?? '';
}
?>
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Замовити товар</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            color: #222;
            min-height: 100vh;
        }

        .hero {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #fff;
            padding: 48px 20px 56px;
            text-align: center;
        }

        .hero .badge {
            display: inline-block;
            background: #e94560;
            color: #fff;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 1px;
            text-transform: uppercase;
            padding: 4px 14px;
            border-radius: 20px;
            margin-bottom: 18px;
        }

        .hero h1 {
            font-size: clamp(24px, 5vw, 42px);
            font-weight: 800;
            line-height: 1.2;
            margin-bottom: 14px;
        }

        .hero h1 span { color: #f0b429; }

        .hero p {
            font-size: 16px;
            color: rgba(255,255,255,0.75);
            max-width: 480px;
            margin: 0 auto 28px;
            line-height: 1.6;
        }

        .price-block {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            margin-bottom: 8px;
        }

        .price-old {
            font-size: 20px;
            color: rgba(255,255,255,0.4);
            text-decoration: line-through;
        }

        .price-new {
            font-size: 36px;
            font-weight: 800;
            color: #f0b429;
        }

        .price-label {
            font-size: 13px;
            color: rgba(255,255,255,0.5);
            text-align: center;
            margin-bottom: 6px;
        }

        /* Форма */
        .form-wrap {
            max-width: 480px;
            margin: -32px auto 40px;
            padding: 0 16px;
            position: relative;
            z-index: 10;
        }

        .card {
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.12);
            padding: 32px 28px;
        }

        .card h2 {
            font-size: 20px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 6px;
            color: #111;
        }

        .card .sub {
            font-size: 14px;
            color: #888;
            text-align: center;
            margin-bottom: 24px;
        }

        .field {
            width: 100%;
            padding: 14px 16px;
            border: 2px solid #e8e8e8;
            border-radius: 10px;
            font-size: 16px;
            color: #222;
            transition: border-color 0.2s;
            margin-bottom: 12px;
            background: #fafafa;
        }

        .field:focus {
            outline: none;
            border-color: #0f3460;
            background: #fff;
        }

        .field::placeholder { color: #aaa; }

        .btn {
            display: block;
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #e94560, #c0392b);
            color: #fff;
            font-size: 18px;
            font-weight: 700;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            letter-spacing: 0.5px;
            transition: transform 0.1s, box-shadow 0.2s;
            box-shadow: 0 4px 16px rgba(233,69,96,0.4);
            margin-top: 4px;
        }

        .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(233,69,96,0.5); }
        .btn:active { transform: translateY(0); }

        .guarantee {
            text-align: center;
            font-size: 12px;
            color: #bbb;
            margin-top: 14px;
        }

        /* Преимущества */
        .benefits {
            max-width: 480px;
            margin: 0 auto 40px;
            padding: 0 16px;
        }

        .benefits h3 {
            font-size: 18px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 16px;
            color: #111;
        }

        .benefit-item {
            display: flex;
            align-items: flex-start;
            gap: 14px;
            padding: 14px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
            margin-bottom: 10px;
        }

        .benefit-icon {
            font-size: 28px;
            flex-shrink: 0;
            line-height: 1;
        }

        .benefit-item strong {
            display: block;
            font-size: 15px;
            color: #111;
            margin-bottom: 2px;
        }

        .benefit-item p {
            font-size: 13px;
            color: #666;
            line-height: 1.5;
        }

        /* Шаги */
        .steps {
            max-width: 480px;
            margin: 0 auto 40px;
            padding: 0 16px;
        }

        .steps h3 {
            font-size: 18px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 16px;
        }

        .step {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 12px;
        }

        .step-num {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #0f3460;
            color: #fff;
            font-weight: 700;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .step p { font-size: 14px; color: #444; }

        /* Футер */
        footer {
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #bbb;
        }

        @media (max-width: 400px) {
            .card { padding: 24px 18px; }
        }
    </style>
</head>
<body>

<!-- Шапка / Оффер -->
<div class="hero">
    <div class="badge">Акція обмежена</div>
    <h1>Отримайте товар з <span>доставкою</span><br>по всій Україні</h1>
    <p>Заповніть форму нижче, і наш менеджер зателефонує вам протягом 10 хвилин</p>
    <div class="price-label">Ціна зі знижкою</div>
    <div class="price-block">
        <span class="price-old">2 500 грн</span>
        <span class="price-new">1 499 грн</span>
    </div>
</div>

<!-- Форма замовлення -->
<div class="form-wrap">
    <div class="card">
        <h2>Залишити заявку</h2>
        <p class="sub">Оплата тільки при отриманні</p>

        <form action="send.php" method="post">
            <!-- UTM приховані поля -->
            <input type="hidden" name="utm_source"   value="<?= htmlspecialchars($utm['utm_source'])   ?>">
            <input type="hidden" name="utm_medium"   value="<?= htmlspecialchars($utm['utm_medium'])   ?>">
            <input type="hidden" name="utm_term"     value="<?= htmlspecialchars($utm['utm_term'])     ?>">
            <input type="hidden" name="utm_content"  value="<?= htmlspecialchars($utm['utm_content'])  ?>">
            <input type="hidden" name="utm_campaign" value="<?= htmlspecialchars($utm['utm_campaign']) ?>">

            <input class="field" type="text" name="name"  placeholder="Ваше ім'я" required>
            <input class="field" type="tel"  name="phone" placeholder="Ваш номер телефону" required>

            <button class="btn" type="submit">Замовити зараз →</button>
        </form>

        <p class="guarantee">🔒 Ваші дані захищені. Без спаму.</p>
    </div>
</div>

<!-- Переваги -->
<div class="benefits">
    <h3>Чому обирають нас</h3>

    <div class="benefit-item">
        <div class="benefit-icon">🚚</div>
        <div>
            <strong>Безкоштовна доставка</strong>
            <p>Нова Пошта або Укрпошта — по всій Україні</p>
        </div>
    </div>

    <div class="benefit-item">
        <div class="benefit-icon">💳</div>
        <div>
            <strong>Оплата при отриманні</strong>
            <p>Платите лише після того, як побачили товар</p>
        </div>
    </div>

    <div class="benefit-item">
        <div class="benefit-icon">↩️</div>
        <div>
            <strong>14 днів на повернення</strong>
            <p>Не підійшов — повернемо гроші без питань</p>
        </div>
    </div>

    <div class="benefit-item">
        <div class="benefit-icon">⭐</div>
        <div>
            <strong>Гарантія якості</strong>
            <p>Офіційна гарантія виробника на весь товар</p>
        </div>
    </div>
</div>

<!-- Кроки -->
<div class="steps">
    <h3>Як замовити?</h3>
    <div class="step">
        <div class="step-num">1</div>
        <p>Заповніть форму з вашим ім'ям та телефоном</p>
    </div>
    <div class="step">
        <div class="step-num">2</div>
        <p>Менеджер передзвонить і підтвердить замовлення</p>
    </div>
    <div class="step">
        <div class="step-num">3</div>
        <p>Отримайте товар та оплатіть при отриманні</p>
    </div>
</div>

<footer>
    © <?= date('Y') ?> Інтернет-магазин. Всі права захищені.
</footer>

</body>
</html>
