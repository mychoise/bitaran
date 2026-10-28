import * as argon2 from 'argon2';

export const hashPassword = (password: string) =>
  argon2.hash(password, { type: argon2.argon2id });

/** False on mismatch, and on a stored hash argon2 cannot parse. */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Verified against when the email is unknown, so a miss costs the same time as
// a wrong password and response timing does not reveal which emails exist.
const DUMMY_HASH = hashPassword('dummy-password-for-timing');

/** Checks `password` against `hash`, or burns equal time if there is no account. */
export async function checkPassword(
  hash: string | undefined,
  password: string,
): Promise<boolean> {
  if (hash === undefined) {
    await verifyPassword(await DUMMY_HASH, password);
    return false;
  }
  return verifyPassword(hash, password);
}
