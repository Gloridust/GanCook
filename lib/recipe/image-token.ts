import { createHmac, timingSafeEqual } from 'node:crypto'

export type ImportImageGrant = {
  userId: string
  path: string
  expiresAt: number
}

const IMPORT_PATH =
  /^imports\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function assertGrant(grant: ImportImageGrant): void {
  if (
    !grant.userId ||
    !IMPORT_PATH.test(grant.path) ||
    !Number.isSafeInteger(grant.expiresAt)
  ) {
    throw new Error('INVALID_IMPORT_IMAGE_TOKEN')
  }
}

export function createImportImageToken(
  grant: ImportImageGrant,
  secret: string,
): string {
  assertGrant(grant)
  const payload = Buffer.from(JSON.stringify(grant)).toString('base64url')
  return `${payload}.${signature(payload, secret)}`
}

export function verifyImportImageToken(
  token: string,
  userId: string,
  secret: string,
  now = Date.now(),
): ImportImageGrant {
  const [payload, receivedSignature, extra] = token.split('.')
  if (!payload || !receivedSignature || extra) {
    throw new Error('INVALID_IMPORT_IMAGE_TOKEN')
  }
  const expectedSignature = signature(payload, secret)
  const received = Buffer.from(receivedSignature)
  const expected = Buffer.from(expectedSignature)
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new Error('INVALID_IMPORT_IMAGE_TOKEN')
  }

  let grant: ImportImageGrant
  try {
    grant = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as ImportImageGrant
  } catch {
    throw new Error('INVALID_IMPORT_IMAGE_TOKEN')
  }
  assertGrant(grant)
  if (grant.userId !== userId || grant.expiresAt < now) {
    throw new Error('INVALID_IMPORT_IMAGE_TOKEN')
  }
  return grant
}
