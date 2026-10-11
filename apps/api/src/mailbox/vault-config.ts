export const VAULT = {
	version: "v1",
	algorithm: "aes-256-gcm",
	keyBytes: 32,
	ivBytes: 12,
	salt: "crm-credential-vault",
	info: "connection-secrets",
	separator: ".",
} as const;
