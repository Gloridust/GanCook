import bcrypt from 'bcryptjs'

const ROUNDS = 10

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS)
}

export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
