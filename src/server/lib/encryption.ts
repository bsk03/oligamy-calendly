import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "@/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
	return Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns format: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, getKey(), iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a string in `iv:authTag:ciphertext` format (hex-encoded).
 */
export function decrypt(encrypted: string): string {
	const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
	if (!ivHex || !authTagHex || !ciphertextHex) {
		throw new Error("Invalid encrypted format");
	}

	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");
	const ciphertext = Buffer.from(ciphertextHex, "hex");

	const decipher = createDecipheriv(ALGORITHM, getKey(), iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	]);

	return decrypted.toString("utf8");
}

/**
 * Checks if a value looks like an encrypted string (hex:hex:hex format).
 * Used for on-read migration of plaintext tokens.
 */
export function isEncrypted(value: string): boolean {
	const parts = value.split(":");
	if (parts.length !== 3) return false;
	return parts.every((part) => /^[0-9a-f]+$/i.test(part));
}
