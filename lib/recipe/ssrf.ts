import { BlockList, isIP } from 'node:net'

const blockedV4 = new BlockList()
const blockedV6 = new BlockList()

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedV4.addSubnet(network, prefix, 'ipv4')
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  // IPv4-compatible（已废弃，如 [::127.0.0.1]）
  ['::', 96],
  ['::ffff:0:0', 96],
  // NAT64 知名前缀（64:ff9b::7f00:1 在 NAT64 网络里就是 127.0.0.1）
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  // 已废弃的站点本地地址
  ['fec0::', 10],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockedV6.addSubnet(network, prefix, 'ipv6')
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blockedV4.check(address, 'ipv4')
  if (family === 6) return !blockedV6.check(address, 'ipv6')
  return false
}

export function selectPublicAddress(
  addresses: Array<{ address: string; family: number }>,
): { address: string; family: 4 | 6 } {
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicIpAddress(address))
  ) {
    throw new Error('UNSAFE_URL')
  }
  const selected = addresses[0]
  if (selected.family !== 4 && selected.family !== 6) {
    throw new Error('UNSAFE_URL')
  }
  return { address: selected.address, family: selected.family }
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  )
}

export function assertSafeRemoteUrl(value: string | URL): URL {
  const url = value instanceof URL ? new URL(value) : new URL(value)
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password
  ) {
    throw new Error('UNSAFE_URL')
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (isBlockedHostname(hostname)) throw new Error('UNSAFE_URL')
  if (isIP(hostname) && !isPublicIpAddress(hostname)) {
    throw new Error('UNSAFE_URL')
  }
  return url
}
