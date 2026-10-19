import { describe, it, expect } from 'vitest';
import {
  COMPLEXITY_MAP,
  WEIGHTS,
  calculateWorkloadScore,
  calculateOnTimeScore,
  calculateQualityScore,
  calculateProgressScore,
  calculateFinalScore,
  getRankInfo,
} from '../src/lib/performanceMath';

describe('Performance Math & Rubric (Thang điểm 100)', () => {
  describe('Complexity mapping', () => {
    it('maps complexity correctly (XS=1, S=2, M=3, L=5, XL=8)', () => {
      expect(COMPLEXITY_MAP.XS).toBe(1);
      expect(COMPLEXITY_MAP.S).toBe(2);
      expect(COMPLEXITY_MAP.M).toBe(3);
      expect(COMPLEXITY_MAP.L).toBe(5);
      expect(COMPLEXITY_MAP.XL).toBe(8);
    });

    it('has standard rubric weights totaling 100 points', () => {
      expect(WEIGHTS.WORKLOAD).toBe(40);
      expect(WEIGHTS.ON_TIME).toBe(25);
      expect(WEIGHTS.QUALITY).toBe(25);
      expect(WEIGHTS.PROGRESS).toBe(10);
      expect(WEIGHTS.WORKLOAD + WEIGHTS.ON_TIME + WEIGHTS.QUALITY + WEIGHTS.PROGRESS).toBe(100);
    });
  });

  describe('Workload score (Max 40)', () => {
    it('returns score proportional to completed/planned points', () => {
      const res = calculateWorkloadScore(5, 10);
      expect(res.hasData).toBe(true);
      expect(res.score).toBe(20);
    });

    it('caps workload score at 40 when completed exceeds planned', () => {
      const res = calculateWorkloadScore(15, 10);
      expect(res.hasData).toBe(true);
      expect(res.score).toBe(40);
    });

    it('handles zero planned points as missing data', () => {
      const res = calculateWorkloadScore(0, 0);
      expect(res.hasData).toBe(false);
      expect(res.score).toBe(0);
    });
  });

  describe('On-time score (Max 25)', () => {
    it('calculates on-time score accurately', () => {
      const res = calculateOnTimeScore(4, 8);
      expect(res.hasData).toBe(true);
      expect(res.score).toBe(12.5);
    });

    it('awards full 25 points when 100% completed on time', () => {
      const res = calculateOnTimeScore(10, 10);
      expect(res.hasData).toBe(true);
      expect(res.score).toBe(25);
    });

    it('treats no due-date tasks as missing data', () => {
      const res = calculateOnTimeScore(0, 0);
      expect(res.hasData).toBe(false);
      expect(res.score).toBe(0);
    });
  });

  describe('Quality score (Max 25)', () => {
    it('calculates 5-star rating as full 25 points', () => {
      // 5 stars = 1.0 ratio -> 1.0 * 25 = 25
      const res = calculateQualityScore(1.0 * 10, 10);
      expect(res.hasData).toBe(true);
      expect(res.score).toBe(25);
    });

    it('calculates 3-star rating as 15 points (3/5 * 25)', () => {
      // 3 stars = 0.6 ratio -> 0.6 * 25 = 15
      const res = calculateQualityScore(0.6 * 10, 10);
      expect(res.hasData).toBe(true);
      expect(res.score).toBe(15);
    });

    it('treats unreviewed tasks as missing data', () => {
      const res = calculateQualityScore(0, 0);
      expect(res.hasData).toBe(false);
      expect(res.score).toBe(0);
    });
  });

  describe('Progress score (Max 10)', () => {
    it('calculates valid / required progress updates', () => {
      const res = calculateProgressScore(1, 2);
      expect(res.hasData).toBe(true);
      expect(res.score).toBe(5);
    });

    it('caps progress score at 10', () => {
      const res = calculateProgressScore(3, 2);
      expect(res.hasData).toBe(true);
      expect(res.score).toBe(10);
    });

    it('treats zero required updates as missing data', () => {
      const res = calculateProgressScore(0, 0);
      expect(res.hasData).toBe(false);
      expect(res.score).toBe(0);
    });
  });

  describe('Missing data handling & Final score calculation', () => {
    it('calculates standard final score with all 4 criteria available', () => {
      const workload = { score: 36, hasData: true }; // 36/40 (90%)
      const onTime = { score: 25, hasData: true };   // 25/25 (100%)
      const quality = { score: 25, hasData: true };  // 25/25 (100%)
      const progress = { score: 10, hasData: true }; // 10/10 (100%)

      const result = calculateFinalScore(workload, onTime, quality, progress);
      expect(result.availableWeight).toBe(100);
      expect(result.finalScore).toBe(96);
      expect(result.isProvisional).toBe(false);
      expect(result.rank.label).toBe('Xuất sắc');
    });

    it('normalizes final score when some criteria are missing but available weight >= 50%', () => {
      // Workload (40) and Progress (10) = 50 total available weight
      const workload = { score: 36, hasData: true }; // 36 points
      const onTime = { score: 0, hasData: false };
      const quality = { score: 0, hasData: false };
      const progress = { score: 9, hasData: true };  // 9 points
      // Total points = 45 out of 50 available weight -> (45 / 50) * 100 = 90
      const result = calculateFinalScore(workload, onTime, quality, progress);
      expect(result.availableWeight).toBe(50);
      expect(result.finalScore).toBe(90);
      expect(result.isProvisional).toBe(false);
      expect(result.rank.label).toBe('Xuất sắc');
    });

    it('flags score as provisional and avoids official ranking when available weight < 50%', () => {
      // Only Workload (40 weight) available -> < 50%
      const workload = { score: 32, hasData: true };
      const onTime = { score: 0, hasData: false };
      const quality = { score: 0, hasData: false };
      const progress = { score: 0, hasData: false };

      const result = calculateFinalScore(workload, onTime, quality, progress);
      expect(result.availableWeight).toBe(40);
      expect(result.finalScore).toBe(80); // (32 / 40) * 100
      expect(result.isProvisional).toBe(true);
      expect(result.rank.label).toBe('Tạm tính (< 50% DL)');
    });

    it('handles zero available data safely', () => {
      const workload = { score: 0, hasData: false };
      const onTime = { score: 0, hasData: false };
      const quality = { score: 0, hasData: false };
      const progress = { score: 0, hasData: false };

      const result = calculateFinalScore(workload, onTime, quality, progress);
      expect(result.availableWeight).toBe(0);
      expect(result.finalScore).toBe(0);
      expect(result.isProvisional).toBe(true);
    });
  });

  describe('Rank Classification (Xếp loại)', () => {
    it('returns "Xuất sắc" for 90–100', () => {
      const rank = getRankInfo(95, 100);
      expect(rank.label).toBe('Xuất sắc');
    });

    it('returns "Tốt" for 80–89.99', () => {
      const rank = getRankInfo(85.5, 100);
      expect(rank.label).toBe('Tốt');
    });

    it('returns "Đạt" for 65–79.99', () => {
      const rank = getRankInfo(70, 100);
      expect(rank.label).toBe('Đạt');
    });

    it('returns "Cần cải thiện" for 50–64.99', () => {
      const rank = getRankInfo(55, 100);
      expect(rank.label).toBe('Cần cải thiện');
    });

    it('returns "Chưa đạt" for under 50', () => {
      const rank = getRankInfo(42, 100);
      expect(rank.label).toBe('Chưa đạt');
    });
  });
});
