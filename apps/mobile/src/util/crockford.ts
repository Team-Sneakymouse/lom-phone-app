/** Crockford base32 — mirrors the Paper bridge issuer alphabet. */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const LINK_CODE_LENGTH = 10;

const CHAR_PATTERN = new RegExp(`^[${CROCKFORD_ALPHABET}]{${LINK_CODE_LENGTH}}$`);

/** Normalize typed input: uppercase, strip separators, map ambiguous glyphs. */
export function normalizeLinkCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[-\s]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function isLinkCode(value: string): boolean {
  return CHAR_PATTERN.test(normalizeLinkCode(value));
}
