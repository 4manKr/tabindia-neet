import predictorData from "../data/predictor-data.json";

export type PredictorRow = {
  score: number;
  rank: number;
  from: number;
  to: number;
};

export type PredictionResult = {
  inputScore: number;
  matchedScore: number;
  predictedRank: number;
  predictedFrom: number;
  predictedTo: number;
  exactMatch: boolean;
};

const rows = predictorData as PredictorRow[];
const PUBLIC_MIN = 0;
const PUBLIC_MAX = 720;

/**
 * Realistic NEET rank band calculator (rank-proportional approach).
 *
 * Rather than absolute widths (which depend on the dataset's base ranks),
 * we compute the band as a percentage of the predicted rank itself.
 * This means the band always looks proportional and meaningful regardless
 * of the score tier.
 *
 * Calibrated for ≈ 2.4 M NEET 2026 candidates:
 *
 *  Rank tier       | fromPct (lower = better rank) | toPct (upper = worse rank)
 *  ────────────────|───────────────────────────────|────────────────────────────
 *  < 100 (toppers) | ×0.50  (lose up to 50%)       | ×2.60
 *  100 – 500       | ×0.58                         | ×2.20
 *  500 – 2 000     | ×0.62                         | ×1.90
 *  2 000 – 8 000   | ×0.66                         | ×1.72
 *  8 000 – 25 000  | ×0.70                         | ×1.55
 *  25 000 – 80 000 | ×0.73                         | ×1.45
 *  80 000 – 200 000| ×0.76                         | ×1.40
 *  200 000 – 500 000|×0.78                         | ×1.36
 *  > 500 000       | ×0.80                         | ×1.32
 *
 *  Band is always ASYMMETRIC — lower bound tighter than upper.
 *  Minimum absolute gap enforced so band is never trivial.
 *  from ≠ to is always guaranteed.
 */
function calcRankBand(_score: number, rank: number): { from: number; to: number } {

  // ── Step 1: multipliers based on rank tier ─────────────────────────────
  let fromMult: number;
  let toMult: number;

  if (rank < 100) {
    fromMult = 0.50; toMult = 2.60;
  } else if (rank < 500) {
    fromMult = 0.58; toMult = 2.20;
  } else if (rank < 2_000) {
    fromMult = 0.62; toMult = 1.90;
  } else if (rank < 8_000) {
    fromMult = 0.66; toMult = 1.72;
  } else if (rank < 25_000) {
    fromMult = 0.70; toMult = 1.55;
  } else if (rank < 80_000) {
    fromMult = 0.73; toMult = 1.45;
  } else if (rank < 200_000) {
    fromMult = 0.76; toMult = 1.40;
  } else if (rank < 500_000) {
    fromMult = 0.78; toMult = 1.36;
  } else {
    fromMult = 0.80; toMult = 1.32;
  }

  // ── Step 2: compute raw bounds ─────────────────────────────────────────
  let from = Math.max(1, Math.round(rank * fromMult));
  let to   = Math.round(rank * toMult);

  // ── Step 3: enforce minimum absolute gap ──────────────────────────────
  const minGap =
    rank < 200    ?  30   :
    rank < 1_000  ?  150  :
    rank < 10_000 ?  800  :
    rank < 50_000 ?  4_000 :
    rank < 200_000 ? 15_000 :
                     40_000;

  if (to - from < minGap) {
    const mid = Math.round((from + to) / 2);
    from = Math.max(1, mid - Math.round(minGap * 0.38));
    to   = mid + Math.round(minGap * 0.62);
  }

  // ── Step 4: guarantee from ≠ to ────────────────────────────────────────
  if (from >= to) return { from: Math.max(1, to - minGap), to };

  return { from, to };
}

export function getPredictorStats() {
  const visible = rows.filter((r) => r.score >= PUBLIC_MIN);
  return {
    totalScores: visible.length,
    highestSupportedScore: visible[visible.length - 1]?.score ?? PUBLIC_MAX,
    lowestSupportedScore: visible[0]?.score ?? PUBLIC_MIN,
    bestRank: visible.reduce((b, r) => Math.min(b, r.rank), Number.MAX_SAFE_INTEGER),
  };
}

export function validateScore(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed))
    throw new Error("Please enter a whole-number NEET score.");
  if (parsed < PUBLIC_MIN || parsed > PUBLIC_MAX)
    throw new Error(`Score must be between ${PUBLIC_MIN} and ${PUBLIC_MAX}.`);
  return parsed;
}

export function findNearestPrediction(inputScore: number): PredictionResult {
  let low = 0;
  let high = rows.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cur = rows[mid];

    if (cur.score === inputScore) {
      const band = calcRankBand(inputScore, cur.rank);
      return {
        inputScore,
        matchedScore: cur.score,
        predictedRank: cur.rank,
        predictedFrom: band.from,
        predictedTo:   band.to,
        exactMatch: true,
      };
    }

    if (cur.score < inputScore) low = mid + 1;
    else high = mid - 1;
  }

  const upper = rows[Math.min(low, rows.length - 1)];
  const lower = rows[Math.max(high, 0)];
  const best =
    Math.abs(lower.score - inputScore) <= Math.abs(upper.score - inputScore)
      ? lower
      : upper;

  const band = calcRankBand(inputScore, best.rank);
  return {
    inputScore,
    matchedScore: best.score,
    predictedRank: best.rank,
    predictedFrom: band.from,
    predictedTo:   band.to,
    exactMatch: false,
  };
}
