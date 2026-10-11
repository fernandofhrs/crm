import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
} from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation";
import { VAULT } from "./vault-config";

const ENCODING = "base64url";

@Injectable()
export class CredentialVaultService {
	private readonly key: Buffer;

	constructor(config: ConfigService<EnvironmentVariables, true>) {
		const secret = config.get("BETTER_AUTH_SECRET", { infer: true });

		this.key = Buffer.from(
			hkdfSync("sha256", secret, VAULT.salt, VAULT.info, VAULT.keyBytes),
		);
	}

	seal(plain: string): string {
		const iv = randomBytes(VAULT.ivBytes);
		const cipher = createCipheriv(VAULT.algorithm, this.key, iv);
		const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);

		return [
			VAULT.version,
			iv.toString(ENCODING),
			cipher.getAuthTag().toString(ENCODING),
			data.toString(ENCODING),
		].join(VAULT.separator);
	}

	open(sealed: string): string | null {
		const [version, iv, tag, data] = sealed.split(VAULT.separator);

		if (version !== VAULT.version || !iv || !tag || data === undefined) {
			return null;
		}

		try {
			const decipher = createDecipheriv(
				VAULT.algorithm,
				this.key,
				Buffer.from(iv, ENCODING),
			);
			decipher.setAuthTag(Buffer.from(tag, ENCODING));

			return Buffer.concat([
				decipher.update(Buffer.from(data, ENCODING)),
				decipher.final(),
			]).toString("utf8");
		} catch {
			return null;
		}
	}
}
