# Warehouse Forum

Корпоративный портал склада на Next.js, Supabase и Vercel.

## Стек

- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: Supabase PostgreSQL + Row Level Security
- Авторизация: Supabase Auth
- Файлы: Supabase Storage
- Деплой: Vercel
- Код: GitHub

## Локальный запуск

1. Установите Node.js 20 LTS или новее.
2. Установите зависимости:

```bash
npm install
```

## Google Sheets user sync

Таблица пользователей должна иметь колонки:

```text
Логин / ФИО / Должность / Роль / Состояние / Пароль
```

Для синхронизации через закрытую Google таблицу:

1. Создайте Google Cloud service account.
2. Скопируйте email service account и дайте ему доступ на чтение к таблице.
3. Добавьте в `.env.local`:

```bash
GOOGLE_SHEETS_SPREADSHEET_ID=spreadsheet-id-from-url
GOOGLE_SHEETS_RANGE=Users!A:F
GOOGLE_SERVICE_ACCOUNT_EMAIL=sync-bot@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
USER_SYNC_SECRET=random-long-secret
```

Синхронизацию можно запустить кнопкой в `/admin` или запросом:

```bash
curl -H "Authorization: Bearer random-long-secret" https://your-domain/api/sync-users
```

Если таблица опубликована как CSV, можно вместо service account указать только:

```bash
GOOGLE_SHEETS_CSV_URL=https://docs.google.com/spreadsheets/d/e/.../pub?output=csv
```

3. Создайте `.env.local` по примеру `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. Запустите проект:

```bash
npm run dev
```

Если нет прав администратора, можно использовать portable Node.js в папке `%USERPROFILE%\Tools\nodejs`.
Для этого в проект добавлены команды:

```bat
install.cmd
dev.cmd
build.cmd
```

## Настройка Supabase

1. Создайте новый проект в Supabase.
2. Откройте SQL Editor.
3. Выполните файл `supabase/migrations/001_initial_schema.sql`.
4. Если база уже была создана раньше, дополнительно выполните `supabase/migrations/002_usernames_and_import.sql`.
5. В Auth включите вход по email/password.
6. Создайте первого пользователя вручную в Auth или через админ-панель Supabase.
7. Для первого администратора обновите роль в таблице `profiles`:

```sql
update public.profiles
set role = 'admin', full_name = 'Администратор', username = 'admin'
where id = 'USER_UUID';
```

## Деплой на Vercel

1. Создайте приватный репозиторий на GitHub.
2. Загрузите туда проект.
3. Подключите репозиторий в Vercel.
4. В Vercel добавьте переменные окружения:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

5. Запустите первый деплой.

## Первый MVP

Уже заложены:

- вход через Supabase Auth;
- защищенные страницы;
- роли `employee`, `shift_lead`, `admin`;
- сводка склада;
- форум с созданием тем;
- раздел документов под Supabase Storage;
- профиль пользователя;
- админ-панель `/admin` для ролей, объявлений и модерации;
- импорт сотрудников из Google Sheets через вставку таблицы `Логин / ФИО / Должность / Роль / Состояние / Пароль`;
- RLS-политики для базовой безопасности.

Обычные сотрудники могут создавать обсуждения. Объявления, закрепление, документы и управление ролями оставлены для модераторов/администраторов.

Роли при импорте из Google Sheets:

```text
Админ      -> admin
Модератор  -> shift_lead
Сотрудник  -> employee
```
