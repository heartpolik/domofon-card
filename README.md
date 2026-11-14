# Domofon Card

Картка Lovelace для інтеграції [Smart Domofon](https://github.com/heartpolik/ha-domofon).

- 🔔 Під час дзвінка картка підсвічується, дзвіночок анімується, з'являються великі кнопки **Відчинити / Скинути**.
- 🚪 Поза дзвінком кнопка «Відчинити» спрацьовує лише після підтвердження другим натисканням. Там же є «Відпустити лінію».
- 🎛 Перемикач режимів: Звичайний · Один раз · Завжди відчиняти · Завжди скидати.
- 📜 Останні дзвінки: результат, час, як відчинено (авто / з телефону / вручну).
- 🌗 Кольори з теми HA. Інтерфейс українською або англійською, залежно від мови HA.
- Візуальний редактор, працює в секціях.

## Встановлення (HACS)

1. HACS → ⋮ → **Custom repositories** → `https://github.com/heartpolik/domofon-card`, тип **Dashboard**.
2. Встановіть **Domofon Card**, оновіть сторінку браузера.

Вручну: скопіюйте `dist/domofon-card.js` у `/config/www/` і додайте ресурс `/local/domofon-card.js` (JavaScript module).

## Налаштування

```yaml
type: custom:domofon-card
entity: sensor.domofon_calls_today   # сенсор інтеграції Smart Domofon (можна не вказувати, знайде сам)
name: Домофон                        # необов'язково
history: 5                           # скільки останніх дзвінків показувати (0 — сховати)
```

Без інтеграції сутності можна вказати вручну:

```yaml
type: custom:domofon-card
entities:
  mode: select.domofon_mode
  open: button.domofon_open
  reject: button.domofon_reject
  release: button.domofon_release_line
  incoming_call: binary_sensor.domofon_incoming_call
  last_event: sensor.domofon_last_event
```

## Ліцензія

MIT
