<?php
session_start();
header('Content-Type: text/html; charset=UTF-8');

$name  = isset($_POST['name'])  ? htmlspecialchars(trim($_POST['name']),  ENT_QUOTES, 'UTF-8') : '';
$phone = isset($_POST['phone']) ? htmlspecialchars(trim($_POST['phone']), ENT_QUOTES, 'UTF-8') : '';

$name  = substr($name,  0, 100);
$phone = substr($phone, 0, 20);

if (empty($name) || empty($phone)) {
    echo '<p style="color:red;text-align:center;font-family:sans-serif;padding:40px">Заповніть ім\'я та телефон. <a href="javascript:history.back()">Назад</a></p>';
    exit;
}

// UTM-параметри з POST
$utm_source   = $_POST['utm_source']   ?? '';
$utm_medium   = $_POST['utm_medium']   ?? '';
$utm_campaign = $_POST['utm_campaign'] ?? '';
$utm_term     = $_POST['utm_term']     ?? '';
$utm_content  = $_POST['utm_content']  ?? '';

$notes = implode(' | ', array_filter([$utm_source, $utm_medium, $utm_campaign, $utm_term, $utm_content]));

// Відправляємо в CRM
$payload = json_encode([
    'customer' => [
        'name'  => $name,
        'phone' => $phone,
    ],
    'items' => [
        [
            'name'     => 'Товар',
            'quantity' => 1,
            'price'    => 1499,
        ],
    ],
    'source' => 'LANDING',
    'notes'  => $notes,
]);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL,            'http://localhost:3001/api/webhook/order');
curl_setopt($ch, CURLOPT_POST,           1);
curl_setopt($ch, CURLOPT_POSTFIELDS,     $payload);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_TIMEOUT,        10);
curl_setopt($ch, CURLOPT_HTTPHEADER,     [
    'Content-Type: application/json',
    'Accept: application/json',
    'X-Webhook-Token: demo-webhook-token-change-in-production',
]);
curl_exec($ch);
curl_close($ch);
?>
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Дякуємо за замовлення!</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: #fff;
            border-radius: 20px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.10);
            padding: 48px 36px;
            max-width: 440px;
            width: 100%;
            text-align: center;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
            display: block;
        }
        h1 {
            font-size: 26px;
            font-weight: 800;
            color: #111;
            margin-bottom: 12px;
        }
        p {
            font-size: 16px;
            color: #555;
            line-height: 1.6;
            margin-bottom: 10px;
        }
        .name { color: #0f3460; font-weight: 700; }
        .back {
            display: inline-block;
            margin-top: 28px;
            padding: 12px 28px;
            background: #0f3460;
            color: #fff;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            font-size: 15px;
            transition: opacity 0.2s;
        }
        .back:hover { opacity: 0.85; }
    </style>
</head>
<body>
    <div class="card">
        <span class="icon">✅</span>
        <h1>Дякуємо, <?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?>!</h1>
        <p>Ваша заявка прийнята.</p>
        <p>Наш менеджер зателефонує вам найближчим часом на номер<br>
           <strong><?= htmlspecialchars($phone, ENT_QUOTES, 'UTF-8') ?></strong>
        </p>
        <a class="back" href="index.php">← На головну</a>
    </div>
</body>
</html>
