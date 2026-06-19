const loginEmailDomain = "warehouse.local";

export function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

export function loginToEmail(login: string) {
  const normalized = normalizeLogin(login);

  if (normalized.includes("@")) {
    return normalized;
  }

  return `${normalized}@${loginEmailDomain}`;
}
