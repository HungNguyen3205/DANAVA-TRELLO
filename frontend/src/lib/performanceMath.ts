export const COMPLEXITY_MAP: Record<string, number> = {
  XS: 1,
  S: 2,
  M: 3,
  L: 5,
  XL: 8,
};

export const WEIGHTS = {
  WORKLOAD: 40,
  ON_TIME: 25,
  QUALITY: 25,
  PROGRESS: 10,
};

export interface RankInfo {
  label: string;
  badgeClass: string;
  description: string;
}

export function getRankInfo(finalScore: number, availableWeight: number, isProvisional?: boolean): RankInfo {
  if (availableWeight < 50 || isProvisional) {
    return {
      label: 'Tạm tính (< 50% DL)',
      badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
      description: 'Chưa đủ 50% trọng số dữ liệu để xếp loại chính thức',
    };
  }

  if (finalScore >= 90) {
    return {
      label: 'Xuất sắc',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      description: '90 – 100 điểm',
    };
  }
  if (finalScore >= 80) {
    return {
      label: 'Tốt',
      badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
      description: '80 – 89.99 điểm',
    };
  }
  if (finalScore >= 65) {
    return {
      label: 'Đạt',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
      description: '65 – 79.99 điểm',
    };
  }
  if (finalScore >= 50) {
    return {
      label: 'Cần cải thiện',
      badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
      description: '50 – 64.99 điểm',
    };
  }
  return {
    label: 'Chưa đạt',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    description: 'Dưới 50 điểm',
  };
}

/**
 * Formula calculations on client side for previewing / testing
 */
export function calculateWorkloadScore(completedPoints: number, plannedPoints: number): { score: number; hasData: boolean } {
  if (plannedPoints <= 0) {
    return { score: 0, hasData: false };
  }
  const ratio = Math.min(1, completedPoints / plannedPoints);
  return { score: Math.round(ratio * WEIGHTS.WORKLOAD * 100) / 100, hasData: true };
}

export function calculateOnTimeScore(onTimeCompletedPoints: number, completedDuePoints: number): { score: number; hasData: boolean } {
  if (completedDuePoints <= 0) {
    return { score: 0, hasData: false };
  }
  const ratio = Math.min(1, onTimeCompletedPoints / completedDuePoints);
  return { score: Math.round(ratio * WEIGHTS.ON_TIME * 100) / 100, hasData: true };
}

export function calculateQualityScore(weightedPointsSum: number, totalReviewedPoints: number): { score: number; hasData: boolean } {
  if (totalReviewedPoints <= 0) {
    return { score: 0, hasData: false };
  }
  const ratio = weightedPointsSum / totalReviewedPoints;
  return { score: Math.round(ratio * WEIGHTS.QUALITY * 100) / 100, hasData: true };
}

export function calculateProgressScore(validUpdates: number, requiredUpdates: number): { score: number; hasData: boolean } {
  if (requiredUpdates <= 0) {
    return { score: 0, hasData: false };
  }
  const ratio = Math.min(1, validUpdates / requiredUpdates);
  return { score: Math.round(ratio * WEIGHTS.PROGRESS * 100) / 100, hasData: true };
}

export function calculateFinalScore(
  workload: { score: number; hasData: boolean },
  onTime: { score: number; hasData: boolean },
  quality: { score: number; hasData: boolean },
  progress: { score: number; hasData: boolean }
): { finalScore: number; availableWeight: number; isProvisional: boolean; rank: RankInfo } {
  let availableWeight = 0;
  let totalPoints = 0;

  if (workload.hasData) {
    availableWeight += WEIGHTS.WORKLOAD;
    totalPoints += workload.score;
  }
  if (onTime.hasData) {
    availableWeight += WEIGHTS.ON_TIME;
    totalPoints += onTime.score;
  }
  if (quality.hasData) {
    availableWeight += WEIGHTS.QUALITY;
    totalPoints += quality.score;
  }
  if (progress.hasData) {
    availableWeight += WEIGHTS.PROGRESS;
    totalPoints += progress.score;
  }

  const finalScore = availableWeight > 0 ? Math.round((totalPoints / availableWeight) * 100 * 100) / 100 : 0;
  const isProvisional = availableWeight < 50;
  const rank = getRankInfo(finalScore, availableWeight, isProvisional);

  return { finalScore, availableWeight, isProvisional, rank };
}
