import { createSign } from "crypto";
import { normalizeLogin } from "@/lib/auth/login";
import { hashPassword } from "@/lib/auth/password";
import { query } from "@/lib/db";
import type { UserRole, UserStatus } from "@/lib/database.types";

type UserImportRow = {
  username: string;
  fullName: string;
  position: string | null;
  role: UserRole;
  status: UserStatus;
  password: string | null;
};

export type UserSyncResult = {
  created: number;
  updated: number;
  deactivated: number;
  passwordUpdated: number;
  skipped: number;
  totalRows: number;
  errors: string[];
  warnings: string[];
};

export type UserSyncOptions = {
  updateExistingPasswords?: boolean;
  deactivateMissing?: boolean;
  source?: "google" | "manual" | "api";
  triggeredBy?: string | null;
};

function parseRole(value: string): UserRole {
  const normalized = value.trim().toLowerCase();

  if (["admin", "админ", "администратор", "Р°РґРјРёРЅ", "Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ"].includes(normalized)) {
    return "admin";
  }

  if (
    [
      "shift_lead",
      "shift lead",
      "moderator",
      "mod",
      "модератор",
      "rs",
      "рс",
      "руководитель смены",
      "старший смены",
      "РјРѕРґРµСЂР°С‚РѕСЂ",
      "СЂСЃ",
      "СЂСѓРєРѕРІРѕРґРёС‚РµР»СЊ СЃРјРµРЅС‹",
      "СЃС‚Р°СЂС€РёР№ СЃРјРµРЅС‹"
    ].includes(normalized)
  ) {
    return "shift_lead";
  }

  return "employee";
}

function parseStatus(value: string): UserStatus {
  const normalized = value.trim().toLowerCase();

  if (
    [
      "inactive",
      "blocked",
      "disabled",
      "уволен",
      "уволена",
      "заблокирован",
      "заблокирована",
      "отключен",
      "отключена",
      "СѓРІРѕР»РµРЅ",
      "СѓРІРѕР»РµРЅР°",
      "Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ",
      "Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅР°",
      "РѕС‚РєР»СЋС‡РµРЅ",
      "РѕС‚РєР»СЋС‡РµРЅР°"
    ].includes(normalized)
  ) {
    return "inactive";
  }

  return "active";
}

function shouldSkipHeader(cells: string[]) {
  const first = (cells[0] || "").trim().toLowerCase();
  return ["login", "логин", "Р»РѕРіРёРЅ"].some((label) => first.includes(label));
}

export function parseTabularUsers(raw: string) {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t|;/).map((cell) => cell.trim()));

  return parseUserRows(rows);
}

export function parseUserRows(rows: string[][]) {
  return rows
    .map((cells) => cells.map((cell) => String(cell || "").trim()))
    .filter((cells) => cells.length >= 5)
    .filter((cells, index) => index > 0 || !shouldSkipHeader(cells))
    .map((cells) => ({
      username: normalizeLogin(cells[0]),
      fullName: cells[1],
      position: cells[2] || null,
      role: parseRole(cells[3] || ""),
      status: parseStatus(cells[4] || ""),
      password: cells[5] || null
    }))
    .filter((row) => row.username && row.fullName);
}

export function validateUserRows(rows: UserImportRow[]) {
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.username)) {
      warnings.push(`${row.username}: duplicate login in source table`);
    }

    seen.add(row.username);

    if (!row.password) {
      warnings.push(`${row.username}: password is empty; new user will be skipped`);
    }
  }

  return warnings;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

async function getGoogleAccessToken() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google service account settings");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    })
  );
  const unsignedJwt = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");

  signer.update(unsignedJwt);
  signer.end();

  const assertion = `${unsignedJwt}.${signer.sign(privateKey).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new Error("Google token response has no access token");
  }

  return data.access_token;
}

async function fetchGoogleSheetRows() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const range = process.env.GOOGLE_SHEETS_RANGE || "Users!A:F";

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
  }

  const accessToken = await getGoogleAccessToken();
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`);
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Google Sheets request failed: ${response.status}`);
  }

  const data = (await response.json()) as { values?: string[][] };
  return data.values || [];
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);

  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

async function fetchCsvRows() {
  const url = process.env.GOOGLE_SHEETS_CSV_URL;

  if (!url) {
    return null;
  }

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Google Sheets CSV request failed: ${response.status}`);
  }

  return parseCsv(await response.text());
}

export async function fetchUsersFromGoogleSheet() {
  const csvRows = await fetchCsvRows();
  const rows = csvRows || (await fetchGoogleSheetRows());
  return parseUserRows(rows);
}

async function deactivateMissingUsers(sourceRows: UserImportRow[], result: UserSyncResult) {
  const sourceUsernames = sourceRows.map((row) => row.username);
  const updated = await query<{ id: string }>(
    `update users set status = 'inactive'
      where status = 'active' and role <> 'admin' and not (lower(username) = any($1::text[]))
      returning id`,
    [sourceUsernames]
  );
  result.deactivated += updated.rowCount || 0;
}

export async function logUserSync(result: UserSyncResult, options: UserSyncOptions = {}) {
  try {
    await query(
      `insert into sync_logs
        (source, triggered_by, created_count, updated_count, deactivated_count, skipped_count,
         password_updated_count, error_count, details)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        options.source || "google",
        options.triggeredBy || null,
        result.created,
        result.updated,
        result.deactivated,
        result.skipped,
        result.passwordUpdated,
        result.errors.length,
        JSON.stringify({
        totalRows: result.totalRows,
        errors: result.errors.slice(0, 25),
        warnings: result.warnings.slice(0, 25)
        })
      ]
    );
  } catch {
    // User synchronization remains available if optional logging fails.
  }
}

export async function syncUsers(rows: UserImportRow[], options: UserSyncOptions = {}): Promise<UserSyncResult> {
  const result: UserSyncResult = {
    created: 0,
    updated: 0,
    deactivated: 0,
    passwordUpdated: 0,
    skipped: 0,
    totalRows: rows.length,
    warnings: validateUserRows(rows),
    errors: []
  };
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.username)) {
      result.skipped += 1;
      continue;
    }

    seen.add(row.username);

    try {
      const existing = await query<{ id: string }>("select id from users where lower(username) = lower($1) limit 1", [row.username]);
      const userId = existing.rows[0]?.id;

      if (userId) {
        if (row.password && options.updateExistingPasswords) {
          const passwordHash = await hashPassword(row.password);
          await query(
            `update users set username=$1, full_name=$2, position=$3, role=$4, status=$5, password_hash=$6 where id=$7`,
            [row.username, row.fullName, row.position, row.role, row.status, passwordHash, userId]
          );
          result.passwordUpdated += 1;
        } else {
          await query(
            `update users set username=$1, full_name=$2, position=$3, role=$4, status=$5 where id=$6`,
            [row.username, row.fullName, row.position, row.role, row.status, userId]
          );
        }
        result.updated += 1;
      } else {
        if (!row.password) {
          result.skipped += 1;
          result.errors.push(`${row.username}: password is required for a new user`);
          continue;
        }

        const passwordHash = await hashPassword(row.password);
        await query(
          `insert into users (username, full_name, position, role, status, password_hash)
           values ($1,$2,$3,$4,$5,$6)`,
          [row.username, row.fullName, row.position, row.role, row.status, passwordHash]
        );
        result.created += 1;
      }
    } catch (error) {
      result.errors.push(`${row.username}: ${error instanceof Error ? error.message : "user update failed"}`);
    }
  }

  if (options.deactivateMissing) {
    await deactivateMissingUsers(rows, result);
  }

  await logUserSync(result, options);

  return result;
}

export async function syncUsersFromGoogleSheet(options: UserSyncOptions = {}) {
  return syncUsers(await fetchUsersFromGoogleSheet(), { ...options, source: options.source || "google" });
}
