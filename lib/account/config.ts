/**
 * Where better-vault's optional backend is (accounts, subscriptions, Better
 * Vault AI and Cloud): https://github.com/better-vault/better-vault-backend.
 * A build can point elsewhere with VITE_BETTER_VAULT_API.
 */
export const BACKEND_URL = (
  import.meta.env.VITE_BETTER_VAULT_API || "https://api.better-vault.dev"
).replace(/\/+$/, "");

/** The model Better Vault AI runs; the backend allows no other. */
export const BETTER_VAULT_MODEL = "claude-haiku-5-5";
