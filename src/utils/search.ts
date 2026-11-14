import type { CustomsItem } from '../types';

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeSearchText(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  let str = String(input);
  // Convert Arabic-Indic digits to ASCII digits
  str = str.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  // Remove diacritics / tashkeel
  str = str.replace(ARABIC_DIACRITICS, '');
  // Normalize Arabic letter variants
  str = str
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function getSearchTokens(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

export function itemToCombinedNormalizedString(item: CustomsItem): string {
  return normalizeSearchText(
    [
      item.productName,
      item.category,
      item.brand,
      item.originCountry,
      item.sizeOrMeasure,
      item.barcode,
      item.hsCode,
      item.price,
      item.currency,
      item.packageType,
      item.declarationNumber,
      item.declarationDate,
      item.notes,
    ].join(' ')
  );
}

/**
 * Unordered multi-word search across ALL 13 columns of each customs item.
 * Matches if EVERY token in the query appears anywhere in any field of the item,
 * regardless of word order (e.g. first word + last word + origin + brand + price).
 */
export function searchCustomsItems(items: CustomsItem[], query: string): CustomsItem[] {
  const tokens = getSearchTokens(query);
  if (tokens.length === 0) return items;

  const normalizedQuery = tokens.join(' ');
  const scored: Array<{ item: CustomsItem; score: number }> = [];

  for (const item of items) {
    const combined = itemToCombinedNormalizedString(item);
    const allMatch = tokens.every((token) => combined.includes(token));
    if (!allMatch) continue;

    // Relevance ranking
    let score = 1;
    const normProduct = normalizeSearchText(item.productName);
    if (normProduct.includes(normalizedQuery)) score += 100;
    for (const token of tokens) {
      if (normProduct.includes(token)) score += 10;
    }
    if (normalizeSearchText(item.barcode) === normalizedQuery) score += 200;
    if (normalizeSearchText(item.hsCode) === normalizedQuery) score += 150;

    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.item);
}

const ARABIC_DIACRITIC_CHAR = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;

export function splitHighlightSegments(
  text: string,
  tokens: string[]
): Array<{ text: string; match: boolean }> {
  if (!text || tokens.length === 0) {
    return [{ text: text || '', match: false }];
  }

  const lowerNormChars: Array<{ origIndex: number; normChar: string }> = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ARABIC_DIACRITIC_CHAR.test(ch)) continue;
    lowerNormChars.push({
      origIndex: i,
      normChar: /\s/.test(ch) ? ' ' : normalizeSearchText(ch),
    });
  }

  const normString = lowerNormChars.map((c) => c.normChar).join('');
  const matchedOrigIndices = new Set<number>();

  for (const token of tokens) {
    if (!token) continue;
    let startIdx = 0;
    while (startIdx < normString.length) {
      const found = normString.indexOf(token, startIdx);
      if (found === -1) break;
      for (let k = found; k < found + token.length; k++) {
        if (lowerNormChars[k]) {
          matchedOrigIndices.add(lowerNormChars[k].origIndex);
        }
      }
      startIdx = found + token.length;
    }
  }

  if (matchedOrigIndices.size === 0) {
    return [{ text, match: false }];
  }

  const segments: Array<{ text: string; match: boolean }> = [];
  let currentText = '';
  let currentMatch = matchedOrigIndices.has(0);

  for (let i = 0; i < text.length; i++) {
    const isMatch = matchedOrigIndices.has(i);
    if (isMatch === currentMatch) {
      currentText += text[i];
    } else {
      if (currentText) segments.push({ text: currentText, match: currentMatch });
      currentText = text[i];
      currentMatch = isMatch;
    }
  }
  if (currentText) segments.push({ text: currentText, match: currentMatch });
  return segments;
}
