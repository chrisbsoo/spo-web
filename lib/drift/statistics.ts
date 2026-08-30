export function calculateMean(values: number[]): number {
  if (values.length === 0) {
    throw new Error("Cannot calculate mean of an empty array.");
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function calculateVariance(values: number[]): number {
  if (values.length === 0) {
    throw new Error("Cannot calculate variance of an empty array.");
  }

  const mean = calculateMean(values);

  const squaredDifferences = values.map((value) => {
    const difference = value - mean;
    return difference * difference;
  });

  return calculateMean(squaredDifferences);
}

function quantile(sortedValues: number[], probability: number): number {
  const position = (sortedValues.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = position - lowerIndex;

  return (
    sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight
  );
}

function findBinIndex(value: number, binEdges: number[]): number {
  for (let i = 0; i < binEdges.length; i += 1) {
    if (value <= binEdges[i]) {
      return i;
    }
  }

  return binEdges.length;
}

function countValuesByBin(values: number[], binEdges: number[]): number[] {
  const counts = new Array<number>(binEdges.length + 1).fill(0);

  for (const value of values) {
    const index = findBinIndex(value, binEdges);
    counts[index] = (counts[index] ?? 0) + 1;
  }

  return counts;
}

export function calculatePSI(
  baselineReturns: number[],
  monitoredReturns: number[],
  numberOfBins = 10,
): number {
  if (baselineReturns.length === 0 || monitoredReturns.length === 0) {
    throw new Error("PSI requires non-empty baseline and monitored returns.");
  }

  if (!Number.isInteger(numberOfBins) || numberOfBins < 2) {
    throw new Error("PSI requires at least two bins.");
  }

  if (numberOfBins > baselineReturns.length) {
    throw new Error("PSI cannot use more bins than baseline observations.");
  }

  const sortedBaseline = [...baselineReturns].sort((a, b) => a - b);

  const binEdges: number[] = [];

  for (let i = 1; i < numberOfBins; i += 1) {
    binEdges.push(quantile(sortedBaseline, i / numberOfBins));
  }

  const baselineCounts = countValuesByBin(baselineReturns, binEdges);
  const monitoredCounts = countValuesByBin(monitoredReturns, binEdges);

  const epsilon = 1e-6;
  let psi = 0;

  for (let i = 0; i < baselineCounts.length; i += 1) {
    const baselineProportion = Math.max(
      baselineCounts[i] / baselineReturns.length,
      epsilon,
    );

    const monitoredProportion = Math.max(
      monitoredCounts[i] / monitoredReturns.length,
      epsilon,
    );

    psi +=
      (monitoredProportion - baselineProportion) *
      Math.log(monitoredProportion / baselineProportion);
  }

  return psi;
}

export function calculateKSStatistic(
  baselineReturns: number[],
  monitoredReturns: number[],
): number {
  if (baselineReturns.length === 0 || monitoredReturns.length === 0) {
    throw new Error("KS requires non-empty baseline and monitored returns.");
  }

  const sortedBaseline = [...baselineReturns].sort((a, b) => a - b);
  const sortedMonitored = [...monitoredReturns].sort((a, b) => a - b);

  let baselineIndex = 0;
  let monitoredIndex = 0;
  let maxDifference = 0;

  while (
    baselineIndex < sortedBaseline.length ||
    monitoredIndex < sortedMonitored.length
  ) {
    const nextBaseline =
      baselineIndex < sortedBaseline.length
        ? sortedBaseline[baselineIndex]
        : Infinity;

    const nextMonitored =
      monitoredIndex < sortedMonitored.length
        ? sortedMonitored[monitoredIndex]
        : Infinity;

    const currentValue = Math.min(nextBaseline, nextMonitored);

    while (
      baselineIndex < sortedBaseline.length &&
      sortedBaseline[baselineIndex] <= currentValue
    ) {
      baselineIndex += 1;
    }

    while (
      monitoredIndex < sortedMonitored.length &&
      sortedMonitored[monitoredIndex] <= currentValue
    ) {
      monitoredIndex += 1;
    }

    const baselineCdf = baselineIndex / sortedBaseline.length;
    const monitoredCdf = monitoredIndex / sortedMonitored.length;

    maxDifference = Math.max(
      maxDifference,
      Math.abs(baselineCdf - monitoredCdf),
    );
  }

  return maxDifference;
}

function calculateKSPValue(
  statistic: number,
  baselineSize: number,
  monitoredSize: number,
): number {
  if (statistic === 0) {
    return 1;
  }

  const effectiveSampleSize = Math.sqrt(
    (baselineSize * monitoredSize) / (baselineSize + monitoredSize),
  );

  const lambda =
    (effectiveSampleSize + 0.12 + 0.11 / effectiveSampleSize) * statistic;

  let sum = 0;

  for (let k = 1; k <= 100; k += 1) {
    const term =
      2 * (k % 2 === 1 ? 1 : -1) * Math.exp(-2 * k * k * lambda * lambda);

    sum += term;
  }

  return Math.min(1, Math.max(0, sum));
}

export function calculateKSTest(
  baselineReturns: number[],
  monitoredReturns: number[],
): { statistic: number; pValue: number } {
  const statistic = calculateKSStatistic(baselineReturns, monitoredReturns);

  const pValue = calculateKSPValue(
    statistic,
    baselineReturns.length,
    monitoredReturns.length,
  );

  return {
    statistic,
    pValue,
  };
}
