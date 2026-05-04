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
 * Dynamic NEET rank band calculator — ±5% of predicted rank.
 *
 * Band = [ rank × 0.95,  rank × 1.05 ]
 *
 * This keeps the variation proportional (~5% on each side) across all
 * rank tiers, so the displayed range always feels tight and meaningful.
 *
 * A tier-scaled minimum absolute gap is enforced so the band is never
 * trivially narrow for very low ranks.
 */
function calcRankBand(_score: number, rank: number): { from: number; to: number } {

  // Lower marks (higher rank numbers) get 5% variation for a wider band;
  // top performers (rank < 1000) get 0.05% so the band stays tight.
  const VARIATION = rank < 1_000 ? 0.0005 : 0.03;

  // ── Step 1: compute symmetric bounds ──────────────────────────────────
  let from = Math.max(1, Math.round(rank * (1 - VARIATION)));
  let to   = Math.round(rank * (1 + VARIATION));

  // ── Step 2: enforce tier-scaled minimum absolute gap ──────────────────
  const minGap =
    rank < 100    ?  20   :
    rank < 1_000  ?  50   :
    rank < 10_000 ?  200  :
    rank < 100_000 ? 1_000 :
                     5_000;

  if (to - from < minGap) {
    const mid = Math.round((from + to) / 2);
    from = Math.max(1, mid - Math.round(minGap / 2));
    to   = from + minGap; // extend to from the (possibly clamped) from
  }

  // ── Step 3: guarantee from ≠ to and from ≥ 1 ──────────────────────────
  from = Math.max(1, from);
  if (from >= to) to = from + 1;

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
  // ── Scores at or above the dataset's highest score → always rank 1 ────
  const topRow = rows[rows.length - 1];
  if (inputScore >= topRow.score) {
    const band = calcRankBand(inputScore, topRow.rank);
    return {
      inputScore,
      matchedScore: topRow.score,
      predictedRank: topRow.rank,
      predictedFrom: band.from,   // guaranteed ≥ 1
      predictedTo:   band.to,
      exactMatch: inputScore === topRow.score,
    };
  }

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
