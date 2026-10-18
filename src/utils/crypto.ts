import crypto from 'node:crypto';

export const ENV_MANAGED_TOKEN = 'ENV_MANAGED_TOKEN';

const TOKEN_ENCRYPTION_SALT = 'pollito-token-encryption-v1';
const DOUBLE_URN_HKDF_INFO = 'pollito-double-urn-v1';

/**
 * Encrypts a Slack OAuth token at rest using AES-256-GCM.
 * Output format: enc:v1:<ivHex>:<tagHex>:<ciphertextHex>
 */
export function encryptToken(plainToken: string, masterSecret: string): string {
  const key = crypto.scryptSync(masterSecret, TOKEN_ENCRYPTION_SALT, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainToken, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted Slack token.
 * Returns null if the stored token is a placeholder (ENV_MANAGED_TOKEN / bot_token_managed) or invalid.
 */
export function decryptToken(
  storedValue: string,
  masterSecret: string
): string | null {
  if (
    !storedValue ||
    storedValue === ENV_MANAGED_TOKEN ||
    storedValue === 'bot_token_managed'
  ) {
    return null;
  }

  if (storedValue.startsWith('enc:v1:')) {
    const parts = storedValue.split(':');
    if (parts.length !== 5) {
      return null;
    }
    const [, , ivHex, tagHex, ciphertextHex] = parts;
    try {
      const key = crypto.scryptSync(masterSecret, TOKEN_ENCRYPTION_SALT, 32);
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(tagHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      return null;
    }
  }

  if (storedValue.startsWith('xoxb-')) {
    return storedValue;
  }

  return null;
}

/**
 * Derives a double-urn voter pseudonymization token using HKDF-SHA256
 * combining the server-side master secret and the workspace-specific salt.
 */
export function deriveDoubleUrnVoterToken(
  voterId: string,
  pollId: string,
  workspaceSalt: string,
  masterSecret: string
): string {
  const derivedKey = crypto.hkdfSync(
    'sha256',
    Buffer.from(masterSecret, 'utf8'),
    Buffer.from(workspaceSalt, 'utf8'),
    Buffer.from(DOUBLE_URN_HKDF_INFO, 'utf8'),
    32
  );

  return crypto
    .createHmac('sha256', Buffer.from(derivedKey))
    .update(`${voterId}:${pollId}`)
    .digest('hex');
}
