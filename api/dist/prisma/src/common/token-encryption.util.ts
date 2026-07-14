import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts/decrypts long-lived Facebook page access tokens before they touch
 * the database. Key must be a 32-byte value, base64 or hex encoded, provided
 * via TOKEN_ENCRYPTION_KEY. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export class TokenEncryption {
  private static getKey(): Buffer {
    const raw = process.env.TOKEN_ENCRYPTION_KEY;
    if (!raw) {
      throw new Error('TOKEN_ENCRYPTION_KEY is not set');
    }
    const key = raw.length === 64 ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes');
    }
    return key;
  }

  static encrypt(plainText: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, this.getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // format: iv.authTag.ciphertext, all base64
    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
  }

  static decrypt(payload: string): string {
    const [ivB64, authTagB64, dataB64] = payload.split('.');
    if (!ivB64 || !authTagB64 || !dataB64) {
      throw new Error('Malformed encrypted token payload');
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, this.getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
