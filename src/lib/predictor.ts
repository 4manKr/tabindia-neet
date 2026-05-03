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
      return {
        inputScore,
        matchedScore: cur.score,
        predictedRank: cur.rank,
        predictedFrom: cur.from,
        predictedTo: cur.to,
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

  return {
    inputScore,
    matchedScore: best.score,
    predictedRank: best.rank,
    predictedFrom: best.from,
    predictedTo: best.to,
    exactMatch: false,
  };
}
