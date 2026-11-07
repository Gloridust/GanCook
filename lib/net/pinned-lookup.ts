import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP, type LookupFunction } from 'node:net'
import { selectPublicAddress } from '@/lib/recipe/ssrf'

type ResolvedAddress = { address: string; family: number }
type AddressResolver = (
  hostname: string,
) => Promise<ResolvedAddress[]>

type PinnedLookupOptions = {
  resolveAddresses?: AddressResolver
  allowPrivateNetwork?: boolean
  addressIndex?: number
}

const defaultResolver: AddressResolver = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true })

export async function createPinnedLookup(
  url: URL,
  resolverOrOptions: AddressResolver | PinnedLookupOptions = defaultResolver,
): Promise<LookupFunction> {
  const options =
    typeof resolverOrOptions === 'function'
      ? { resolveAddresses: resolverOrOptions }
      : resolverOrOptions
  const resolveAddresses = options.resolveAddresses ?? defaultResolver
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const family = isIP(hostname)
  const addresses = family
    ? [{ address: hostname, family }]
    : await resolveAddresses(hostname)
  if (!options.allowPrivateNetwork) selectPublicAddress(addresses)
  const eligible = addresses.filter(
    (address): address is { address: string; family: 4 | 6 } =>
      (address.family === 4 || address.family === 6) &&
      isIP(address.address) === address.family,
  )
  const selected = eligible[(options.addressIndex ?? 0) % eligible.length]
  if (!selected) throw new Error('UNSAFE_URL')

  return ((
    _hostname: string,
    options: { all?: boolean },
    callback: (
      error: NodeJS.ErrnoException | null,
      address: string | ResolvedAddress[],
      family?: number,
    ) => void,
  ) => {
    if (options?.all) {
      callback(null, [selected])
      return
    }
    callback(null, selected.address, selected.family)
  }) as LookupFunction
}
