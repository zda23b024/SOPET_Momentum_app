import * as argon2 from 'argon2';
import * as crypto from 'crypto';

export class CryptoUtil {
  private static readonly BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  static generateTotpSecret(): string {
    const randomBytes = crypto.randomBytes(20);
    let encoded = '';
    let buffer = 0;
    let bits = 0;
    for (const byte of randomBytes) {
      buffer = (buffer << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        encoded += this.BASE32_ALPHABET[(buffer >>> bits) & 31];
      }
    }
    if (bits > 0) encoded += this.BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
    return encoded;
  }

  static verifyTotp(secret: string, code: string, timestamp = Date.now()): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const key = this.decodeBase32(secret);
    if (!key.length) return false;
    const counter = Math.floor(timestamp / 30000);
    for (let offset = -1; offset <= 1; offset += 1) {
      const digest = crypto.createHmac('sha1', key)
        .update(Buffer.from(BigInt(counter + offset).toString(16).padStart(16, '0'), 'hex'))
        .digest();
      const index = digest[digest.length - 1] & 0x0f;
      const value = ((digest[index] & 0x7f) << 24) | (digest[index + 1] << 16) | (digest[index + 2] << 8) | digest[index + 3];
      if (String(value % 1_000_000).padStart(6, '0') === code) return true;
    }
    return false;
  }

  private static decodeBase32(secret: string): Buffer {
    const normalized = secret.replace(/\s|=+/g, '').toUpperCase();
    if (!/^[A-Z2-7]+$/.test(normalized) || [1, 3, 6].includes(normalized.length % 8)) return Buffer.alloc(0);
    const decoded: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const character of normalized) {
      buffer = (buffer << 5) | this.BASE32_ALPHABET.indexOf(character);
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        decoded.push((buffer >>> bits) & 255);
      }
    }
    if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) return Buffer.alloc(0);
    return Buffer.from(decoded);
  }
  /**
   * Hashes a password using Argon2id with memoryCost=65536, timeCost=3, parallelism=1.
   */
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  /**
   * Verifies a password against an Argon2id hash.
   */
  static async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Hashes a refresh token or recovery code using SHA-256 for secure storage.
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates a random crypto-secure token (for email verification, reset, or refresh tokens).
   */
  static generateSecureToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Redacts private or sensitive fields from objects before logging.
   * Explicitly strips passwords, tokens, private goal text, barrier explanations, and reflection notes.
   */
  static sanitizeForLogs(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'mfaSecret',
      'whyItMatters',
      'userExplanation',
      'meaningfulProgress',
      'whatGotInTheWay',
      'lessonText',
      'notes',
      'ciphertextPayload',
    ];

    if (Array.isArray(obj)) {
      return obj.map((item) => CryptoUtil.sanitizeForLogs(item));
    }

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        cleaned[key] = '[REDACTED_FOR_PRIVACY]';
      } else if (value && typeof value === 'object') {
        cleaned[key] = CryptoUtil.sanitizeForLogs(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}
