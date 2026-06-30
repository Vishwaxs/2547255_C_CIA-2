import { parseCsv } from '../engine/parseCsv';
import { inferColumnType } from '../engine/infer';
import { buildFrame, Frame } from '../engine/frame';
import {
  detectTrend,
  detectTopCategories,
  detectCorrelation,
  detectOutliers,
  detectDistribution,
  detectDominantCategory,
  detectMissingness,
  detectSegmentVsAverage,
} from '../engine/detectors';

const CFG = {
  correlationThreshold: 0.5,
  outlierIqrFactor: 1.5,
  dominantThreshold: 0.4,
  missingnessThreshold: 0.2,
};

function frame(csv: string): Frame {
  const p = parseCsv(csv);
  const cols = p.headers.map((h) => ({
    name: h,
    inferredType: inferColumnType(p.rows.map((r) => r[h])),
  }));
  return buildFrame(p.rows, cols);
}

describe('detectors', () => {
  it('detectTrend fires on a rising measure over dates', () => {
    let csv = 'date,sales\n';
    for (let i = 0; i < 6; i++) csv += `2026-0${i + 1}-01,${100 + i * 50}\n`;
    const ins = detectTrend(frame(csv));
    expect(ins.length).toBe(1);
    expect(Number(ins[0].detail.pctChange)).toBeGreaterThan(0);
  });

  it('detectTopCategories ranks the leading category', () => {
    const ins = detectTopCategories(frame('region,rev\nNorth,100\nNorth,100\nEast,50\nWest,20'));
    expect(ins[0].detail.topCategory).toBe('North');
  });

  it('detectCorrelation finds a strong positive pair', () => {
    let csv = 'x,y\n';
    for (let i = 1; i <= 10; i++) csv += `${i},${i * 2}\n`;
    const ins = detectCorrelation(frame(csv), CFG);
    expect(ins.length).toBeGreaterThan(0);
    expect(Number(ins[0].detail.r)).toBeGreaterThan(0.9);
  });

  it('detectOutliers flags an extreme value', () => {
    const ins = detectOutliers(frame('v\n1\n2\n3\n4\n5\n6\n7\n8\n9\n500'), CFG);
    expect(ins.length).toBe(1);
    expect(Number(ins[0].detail.count)).toBe(1);
  });

  it('detectDistribution flags a skewed numeric column', () => {
    const ins = detectDistribution(frame('v\n1\n1\n1\n2\n2\n3\n3\n4\n50\n80'));
    expect(ins.length).toBe(1);
    expect(Math.abs(Number(ins[0].detail.skew))).toBeGreaterThanOrEqual(0.5);
  });

  it('detectDominantCategory fires when one value covers >= threshold of rows', () => {
    const ins = detectDominantCategory(frame('c\nA\nA\nA\nB'), CFG);
    expect(ins.length).toBe(1);
    expect(ins[0].detail.value).toBe('A');
    expect(Number(ins[0].detail.share)).toBe(75);
  });

  it('detectMissingness fires on a high-null column', () => {
    const ins = detectMissingness(frame('a,b\n1,\n2,\n3,\n4,x'), CFG);
    expect(ins.length).toBe(1);
    expect(ins[0].detail.column).toBe('b');
  });

  it('detectSegmentVsAverage flags a deviating segment', () => {
    const ins = detectSegmentVsAverage(frame('seg,v\nA,100\nA,100\nB,10\nB,10'));
    expect(ins.length).toBe(1);
    expect(Math.abs(Number(ins[0].detail.pctDiff))).toBeGreaterThanOrEqual(10);
  });
});
