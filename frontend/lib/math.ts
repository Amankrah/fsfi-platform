const RANDOM_INDEX = [0, 0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49, 1.51, 1.48, 1.56, 1.57, 1.59];

/** AHP principal eigenvector (power method) and Saaty consistency ratio, for live builder feedback. */
export function ahp(matrix: number[][]) {
  const n = matrix.length;
  if (n === 0) return { weights: [], lambdaMax: 0, ci: 0, cr: 0 };
  let w = Array(n).fill(1 / n);
  let lambdaMax = n;
  for (let it = 0; it < 1000; it++) {
    const next = matrix.map((row) => row.reduce((a, v, j) => a + v * w[j], 0));
    const s = next.reduce((a, b) => a + b, 0);
    const nw = next.map((v) => v / (s || 1));
    const diff = nw.reduce((a, v, i) => a + Math.abs(v - w[i]), 0);
    w = nw;
    if (diff < 1e-12) break;
  }
  const Aw = matrix.map((row) => row.reduce((a, v, j) => a + v * w[j], 0));
  lambdaMax = Aw.reduce((a, v, i) => a + v / (w[i] || 1), 0) / n;
  const ci = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const ri = RANDOM_INDEX[Math.min(n, RANDOM_INDEX.length - 1)] || 0;
  return { weights: w, lambdaMax, ci, cr: ri > 0 ? ci / ri : 0 };
}
