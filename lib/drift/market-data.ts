export interface MarketPricePoint {
  date: string;
  adjustedClose: number;
}
export interface MarketReturnPoint {
  date: string;
  logReturn: number;
}
export interface AlignedReturnRow {
  date: string;
  returnsByTicker: Record<string, number>;
}
interface YahooChartResponse {
  chart: {
    result: Array<{
      timestamp?: number[];
      indicators: {
        adjclose?: Array<{
          adjclose?: Array<number | null>;
        }>;
      };
    }> | null;
    error: {
      code: string;
      description: string;
    } | null;
  };
}
function toUnixSeconds(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new Error(`Invalid date: ${date}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const milliseconds = Date.UTC(year, month - 1, day);
  const parsedDate = new Date(milliseconds);

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${date}`);
  }

  return Math.floor(milliseconds / 1000);
}
export function calculateLogReturns(prices: number[]): number[] {
  if (prices.length < 2) {
    throw new Error("At least two prices are required to calculate returns.");
  }

  if (prices.some((price) => !Number.isFinite(price) || price <= 0)) {
    throw new Error("Prices must be finite positive numbers.");
  }

  const returns: number[] = [];

  for (let i = 1; i < prices.length; i += 1) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }

  return returns;
}

export function calculateDatedLogReturns(
  pricePoints: MarketPricePoint[],
): MarketReturnPoint[] {
  const returns = calculateLogReturns(
    pricePoints.map((point) => point.adjustedClose),
  );

  return returns.map((logReturn, index) => ({
    date: pricePoints[index + 1].date,
    logReturn,
  }));
}

export function calculateAlignedReturnsFromPrices(
  pricesByTicker: Record<string, MarketPricePoint[]>,
): AlignedReturnRow[] {
  const tickers = Object.keys(pricesByTicker);

  if (tickers.length === 0) {
    throw new Error("At least one ticker price series is required.");
  }

  const priceMaps = Object.fromEntries(
    tickers.map((ticker) => [
      ticker,
      new Map(
        pricesByTicker[ticker].map((point) => [
          point.date,
          point.adjustedClose,
        ]),
      ),
    ]),
  ) as Record<string, Map<string, number>>;

  const allDates = Array.from(
    new Set(
      tickers.flatMap((ticker) =>
        pricesByTicker[ticker].map((point) => point.date),
      ),
    ),
  ).sort();

  const alignedReturns: AlignedReturnRow[] = [];

  for (let i = 1; i < allDates.length; i += 1) {
    const previousDate = allDates[i - 1];
    const currentDate = allDates[i];

    const hasCompleteInterval = tickers.every(
      (ticker) =>
        priceMaps[ticker].has(previousDate) &&
        priceMaps[ticker].has(currentDate),
    );

    if (!hasCompleteInterval) {
      continue;
    }

    const returnsByTicker = Object.fromEntries(
      tickers.map((ticker) => {
        const previousPrice = priceMaps[ticker].get(previousDate)!;

        const currentPrice = priceMaps[ticker].get(currentDate)!;

        const logReturn = calculateLogReturns([previousPrice, currentPrice])[0];

        return [ticker, logReturn];
      }),
    );

    alignedReturns.push({
      date: currentDate,
      returnsByTicker,
    });
  }

  if (alignedReturns.length === 0) {
    throw new Error("No complete return intervals found across tickers.");
  }

  return alignedReturns;
}

export function alignReturnsByTicker(
  returnsByTicker: Record<string, MarketReturnPoint[]>,
): AlignedReturnRow[] {
  const tickers = Object.keys(returnsByTicker);

  if (tickers.length === 0) {
    throw new Error("At least one ticker return series is required.");
  }

  const returnMaps = Object.fromEntries(
    tickers.map((ticker) => [
      ticker,
      new Map(
        returnsByTicker[ticker].map((point) => [point.date, point.logReturn]),
      ),
    ]),
  ) as Record<string, Map<string, number>>;

  const commonDates = returnsByTicker[tickers[0]]
    .map((point) => point.date)
    .filter((date) => tickers.every((ticker) => returnMaps[ticker].has(date)))
    .sort();

  if (commonDates.length === 0) {
    throw new Error("No common return dates found across tickers.");
  }

  return commonDates.map((date) => ({
    date,
    returnsByTicker: Object.fromEntries(
      tickers.map((ticker) => [ticker, returnMaps[ticker].get(date)!]),
    ),
  }));
}

export async function fetchAdjustedClosePrices(
  ticker: string,
  startDate: string,
  endDate: string,
): Promise<MarketPricePoint[]> {
  const symbol = ticker.trim().toUpperCase();

  if (symbol.length === 0) {
    throw new Error("Ticker cannot be empty.");
  }

  const period1 = toUnixSeconds(startDate);
  const endTimestamp = toUnixSeconds(endDate);

  if (period1 >= endTimestamp) {
    throw new Error("Start date must be before end date.");
  }

  const period2 = endTimestamp;

  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  );

  url.searchParams.set("period1", String(period1));
  url.searchParams.set("period2", String(period2));
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "history");
  url.searchParams.set("includeAdjustedClose", "true");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance request failed with status ${response.status}.`,
    );
  }

  const data = (await response.json()) as YahooChartResponse;

  if (data.chart.error) {
    throw new Error(`Yahoo Finance error: ${data.chart.error.description}`);
  }

  const result = data.chart.result?.[0];

  if (!result) {
    throw new Error(`No market data found for ${symbol}.`);
  }

  const timestamps = result.timestamp ?? [];
  const adjustedCloses = result.indicators.adjclose?.[0]?.adjclose ?? [];

  const pricePoints: MarketPricePoint[] = [];

  const observationCount = Math.min(timestamps.length, adjustedCloses.length);

  for (let i = 0; i < observationCount; i += 1) {
    const adjustedClose = adjustedCloses[i];

    if (
      adjustedClose === null ||
      !Number.isFinite(adjustedClose) ||
      adjustedClose <= 0
    ) {
      continue;
    }

    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);

    pricePoints.push({
      date,
      adjustedClose,
    });
  }

  if (pricePoints.length < 2) {
    throw new Error(`Insufficient market data found for ${symbol}.`);
  }

  return pricePoints;
}

export async function fetchAlignedReturnsForTickers(
  tickers: string[],
  startDate: string,
  endDate: string,
): Promise<AlignedReturnRow[]> {
  if (tickers.length === 0) {
    throw new Error("At least one ticker is required.");
  }

  const normalizedTickers = tickers.map((ticker) =>
    ticker.trim().toUpperCase(),
  );

  if (normalizedTickers.some((ticker) => ticker.length === 0)) {
    throw new Error("Tickers cannot be empty.");
  }

  if (new Set(normalizedTickers).size !== normalizedTickers.length) {
    throw new Error("Tickers must be unique.");
  }

  const pricesByTicker: Record<string, MarketPricePoint[]> = {};

  for (const ticker of normalizedTickers) {
    pricesByTicker[ticker] = await fetchAdjustedClosePrices(
      ticker,
      startDate,
      endDate,
    );
  }

  return calculateAlignedReturnsFromPrices(pricesByTicker);
}
