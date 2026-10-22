const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** A bounded visual mask. Whitespace and punctuation retain their positions. */
export function decryptFrame(value: string, progress: number, tick: number): string {
  if (progress >= 1) return value;
  const letters = Array.from(value);
  const resolved = Math.floor(Math.max(0, progress) * letters.length);
  return letters.map((letter, index) => index < resolved || !/[\p{L}\p{N}]/u.test(letter)
    ? letter : GLYPHS[(index * 17 + tick * 7) % GLYPHS.length]).join('');
}
