import { pbkdf2 as nodePbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { env } from '../../../config/env';

// DjangoPasswordHasher — PBKDF2-SHA256 compatible with Django's PBKDF2PasswordHasher.
//
// HV-002 decision (RESOLVED): password hashes are kept in Django format to
//   avoid a data migration. New passwords are hashed in the same Django format.
//
// Django format: pbkdf2_sha256$<iterations>$<salt>$<hash_base64>
//   iterations : integer, read from env.pbkdf2Iterations for new hashes.
//                The stored value is used when verifying (supports legacy/updated iterations).
//   salt       : alphanumeric string (we generate 16 chars of base64url).
//   hash       : PBKDF2-HMAC-SHA256(password_utf8, salt_utf8, iterations, 32 bytes) → base64
//
// Source: apps/accounts/models.py :: user.set_password() → Django hashers.py
//         django.contrib.auth.hashers.PBKDF2PasswordHasher
//
// BR-012 / BR-015 / BR-004 (HV-001): password validators (MinimumLength, etc.)
//   were removed per HV-001 decision. Raw password is hashed as-is.

const ALGORITHM = 'pbkdf2_sha256';

/**
 * Hash a plain-text password using Django-compatible PBKDF2-SHA256.
 * Uses env.pbkdf2Iterations (set to 1 in tests via PBKDF2_ITERATIONS=1).
 */
export async function hashPassword(password: string): Promise<string> {
  const iterations = env.pbkdf2Iterations;
  // Generate a random salt (alphanumeric-safe base64url chars, sliced to 16 chars).
  // Compatible with Django's alphanumeric salt space.
  const salt = randomBytes(12).toString('base64url').slice(0, 16);
  const hash = await pbkdf2Async(password, salt, iterations);
  return `${ALGORITHM}$${iterations}$${salt}$${hash}`;
}

/**
 * Verify a plain-text password against a Django PBKDF2 hash string.
 * Timing-safe to prevent brute-force timing side-channel (BR protection).
 *
 * @param password  plain-text password from user input
 * @param encoded   stored hash in Django format: pbkdf2_sha256$iter$salt$hash
 * @returns true if password matches, false otherwise (never throws)
 */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  // Malformed hash — not 4 parts
  if (parts.length !== 4) return false;
  const [algo, iterStr, salt, storedHash] = parts;
  if (algo !== ALGORITHM) return false;
  const iterations = parseInt(iterStr, 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  try {
    const computedHash = await pbkdf2Async(password, salt, iterations);
    // Timing-safe comparison prevents brute-force timing attacks.
    // Both buffers must be the same length for timingSafeEqual.
    const a = Buffer.from(computedHash, 'base64');
    const b = Buffer.from(storedHash, 'base64');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    // Never propagate crypto errors — treat all failures as verification failure.
    return false;
  }
}

/**
 * Promisified Node.js crypto.pbkdf2 with UTF-8 encoding for both password and salt,
 * matching Django's hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), ...
 */
function pbkdf2Async(password: string, salt: string, iterations: number): Promise<string> {
  return new Promise((resolve, reject) => {
    nodePbkdf2(
      Buffer.from(password, 'utf8'),  // Django: password.encode('utf-8')
      Buffer.from(salt, 'utf8'),      // Django: salt.encode('utf-8')
      iterations,
      32,       // dkLen = 32 bytes (SHA-256 digest size, Django default)
      'sha256',
      (err, key) => {
        if (err) reject(err);
        else resolve(key.toString('base64'));
      },
    );
  });
}
