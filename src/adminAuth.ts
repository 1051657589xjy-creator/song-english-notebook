export const sessionTokenKey = "songbook-admin-token";
export const rememberedTokenKey = "songbook-admin-remembered-token";

export function storedAdminToken() {
  return sessionStorage.getItem(sessionTokenKey) ||
    localStorage.getItem(rememberedTokenKey) || "";
}

export function hasStoredAdminToken() {
  return Boolean(storedAdminToken());
}
