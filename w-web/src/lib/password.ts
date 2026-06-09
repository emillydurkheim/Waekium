// Utilitário de geração de senha temporária segura.
// Isolado para reutilização e fácil substituição futura (ex.: gerar no backend Flask).

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem I/O
const LOWER = "abcdefghijkmnopqrstuvwxyz"; // sem l
const DIGITS = "23456789"; // sem 0/1
const SYMBOLS = "!@#$%&*?";

function pick(set: string, rng: Uint32Array, i: number) {
  return set.charAt(rng[i] % set.length);
}

/** Gera senha temporária com mix de maiúsculas, minúsculas, dígitos e símbolo. */
export function generateTempPassword(length = 10): string {
  const len = Math.max(8, Math.min(32, length));
  const rng = new Uint32Array(len);
  (globalThis.crypto ?? window.crypto).getRandomValues(rng);

  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  // Garante pelo menos 1 de cada categoria
  const required = [
    pick(UPPER, rng, 0),
    pick(LOWER, rng, 1),
    pick(DIGITS, rng, 2),
    pick(SYMBOLS, rng, 3),
  ];
  const rest: string[] = [];
  for (let i = 4; i < len; i++) rest.push(pick(all, rng, i));

  // Shuffle (Fisher-Yates) usando RNG seguro
  const out = [...required, ...rest];
  const shuffleRng = new Uint32Array(out.length);
  (globalThis.crypto ?? window.crypto).getRandomValues(shuffleRng);
  for (let i = out.length - 1; i > 0; i--) {
    const j = shuffleRng[i] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}
