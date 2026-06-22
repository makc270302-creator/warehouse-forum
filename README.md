# Warehouse Forum

Корпоративный портал склада для размещения на российском VPS. Проект рассчитан на 250+ сотрудников и не зависит от Supabase или Vercel.

## Архитектура

- Next.js 14 и TypeScript;
- PostgreSQL 16;
- собственная авторизация с HttpOnly-сессиями;
- пароли в виде хэшей `scrypt`, без хранения исходных паролей;
- роли `employee`, `shift_lead`, `admin`;
- файлы в отдельном Docker volume;
- журнал значимых действий;
- Caddy с автоматическим HTTPS;
- ежедневные резервные копии PostgreSQL;
- Docker Compose для запуска и обновлений.

## Подготовка VPS

Рекомендуемая ОС — Ubuntu 24.04 LTS. Для первой версии достаточно 4 vCPU, 8 ГБ RAM и 100 ГБ SSD.

1. Установите Git и Docker Engine с Compose plugin.
2. Направьте A-запись домена на публичный IP сервера.
3. Откройте входящие TCP-порты 22, 80 и 443. Порт PostgreSQL наружу открывать не нужно.
4. Клонируйте приватный репозиторий:

```bash
git clone https://github.com/makc270302-creator/warehouse-forum.git
cd warehouse-forum
```

5. Создайте боевые настройки:

```bash
cp .env.production.example .env.production
nano .env.production
chmod 600 .env.production
```

Укажите домен и три разные длинные случайные строки: `POSTGRES_PASSWORD`, `BOOTSTRAP_ADMIN_PASSWORD`, `USER_SYNC_SECRET`.

6. Запустите портал:

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

7. Откройте домен и войдите с `BOOTSTRAP_ADMIN_LOGIN` / `BOOTSTRAP_ADMIN_PASSWORD`. При первом входе администратор будет создан автоматически.

После первого входа измените bootstrap-пароль в `.env.production`: он больше не используется, если администратор уже существует.

## Обновление

```bash
sh ops/deploy.sh
```

Скрипт получает изменения из GitHub, собирает приложение и безопасно перезапускает контейнеры.

## Пользователи

В админ-панели поддерживается ручной импорт строк формата:

```text
Логин / ФИО / Должность / Роль / Состояние / Пароль
```

Пароль должен содержать минимум 8 символов. После импорта в PostgreSQL сохраняется только его криптографический хэш.

Для закрытой Google-таблицы задайте переменные `GOOGLE_SHEETS_*`. Для опубликованного CSV достаточно `GOOGLE_SHEETS_CSV_URL`. Автоматическую синхронизацию можно вызвать так:

```bash
curl -H "Authorization: Bearer USER_SYNC_SECRET" https://portal.example.ru/api/sync-users
```

## Документы

Администратор загружает PDF, Word, Excel и изображения размером до 20 МБ. Файлы хранятся в volume `uploads_data` и выдаются только авторизованным сотрудникам.

## Резервные копии

Контейнер `backup` ежедневно создаёт сжатый дамп в каталоге `./backups`. По умолчанию хранятся копии за 14 дней. Каталог резервных копий необходимо дополнительно копировать на другой сервер или в российское S3-хранилище.

Проверка:

```bash
ls -lh backups
docker compose --env-file .env.production logs backup
```

## Локальная разработка

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Локально потребуется PostgreSQL с применённым файлом `database/init.sql`.
