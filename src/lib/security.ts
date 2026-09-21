/**
 * Enterprise Cryptographic Security Utilities
 * Uses the Web Crypto API for secure PBKDF2 salt-and-hash password operations.
 * Plaintext passwords are NEVER stored or transmitted unhashed.
 */

export interface HashedPasswordResult {
  hash: string;
  salt: string;
  iterations: number;
}

/**
 * Generates a cryptographically strong random salt (16 bytes hex-encoded).
 */
export function generateSalt(bytes: number = 16): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes a password using PBKDF2 with SHA-256 and 100,000 iterations.
 * @param password The plaintext password to hash
 * @param existingSalt Optional existing salt for verification
 */
export async function hashPassword(
  password: string,
  existingSalt?: string
): Promise<HashedPasswordResult> {
  const salt = existingSalt || generateSalt(16);
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const iterations = 100000;
  const saltBuffer = enc.encode(salt);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    256 // 32 bytes
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return {
    hash,
    salt,
    iterations,
  };
}

/**
 * Verifies a plaintext password against a stored PBKDF2 hash and salt in constant-time.
 */
export async function verifyPassword(
  attempt: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  try {
    const result = await hashPassword(attempt, salt);
    // Constant-time length and value comparison
    if (result.hash.length !== storedHash.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < result.hash.length; i++) {
      diff |= result.hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return diff === 0;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Validates username according to enterprise rules:
 * - A-Z alphabetic characters only (upper and lowercase allowed)
 * - No spaces
 * - No numbers
 * - No special characters
 * - Case-insensitive uniqueness comparison
 */
export function validateUsername(username: string): {
  isValid: boolean;
  error?: string;
  normalized: string;
} {
  const trimmed = username ? username.trim() : '';
  const normalized = trimmed.toLowerCase();

  if (!trimmed) {
    return { isValid: false, error: 'Username is required.', normalized: '' };
  }

  if (/\s/.test(trimmed)) {
    return { isValid: false, error: 'Username must not contain any spaces.', normalized };
  }

  if (/\d/.test(trimmed)) {
    return { isValid: false, error: 'Username must not contain numbers (A-Z only).', normalized };
  }

  if (/[^a-zA-Z]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username can only contain alphabetic characters (A-Z, a-z). No special characters.',
      normalized,
    };
  }

  return {
    isValid: true,
    normalized,
  };
}

/**
 * Validates password according to enterprise rules:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - Previous passwords may be reused
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
  rules: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
} {
  const minLength = (password || '').length >= 8;
  const hasUppercase = /[A-Z]/.test(password || '');
  const hasLowercase = /[a-z]/.test(password || '');
  const hasNumber = /[0-9]/.test(password || '');
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password || '');

  const errors: string[] = [];
  if (!minLength) errors.push('At least 8 characters long');
  if (!hasUppercase) errors.push('At least one uppercase letter (A-Z)');
  if (!hasLowercase) errors.push('At least one lowercase letter (a-z)');
  if (!hasNumber) errors.push('At least one numeric digit (0-9)');
  if (!hasSpecial) errors.push('At least one special character (!@#$%^&*...)');

  return {
    isValid: minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial,
    errors,
    rules: {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
    },
  };
}

/**
 * Generates a compliant temporary password for admin password resets.
 * Matches: Min 8 chars, Uppercase, Lowercase, Number, Special character.
 */
export function generateTemporaryPassword(): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const specials = '!@#$%&*';

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const randomChars = [
    pick(uppers),
    pick(uppers),
    pick(lowers),
    pick(lowers),
    pick(lowers),
    pick(numbers),
    pick(numbers),
    pick(specials),
    pick(specials),
  ].sort(() => Math.random() - 0.5);

  return `Temp#${randomChars.join('')}`;
}

/**
 * Generates a secure random session token.
 */
export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

