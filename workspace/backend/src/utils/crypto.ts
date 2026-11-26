import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set — refusing to store/read credential secrets.');
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must be a 32-byte value hex-encoded (64 hex characters).');
  }
  return key;
}

// Stored format: iv:authTag:ciphertext, each hex-encoded.
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptSecret(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Malformed encrypted secret.');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
