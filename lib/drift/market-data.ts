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

export function groupAlignedReturnsByTicker(
  rows: AlignedReturnRow[],
): Record<string, number[]> {
  if (rows.length === 0) {
    throw new Error("At least one aligned return row is required.");
  }

  const tickers = Object.keys(rows[0].returnsByTicker);

  if (tickers.length === 0) {
    throw new Error("Aligned return rows must contain at least one ticker.");
  }

  const returnsByTicker = Object.fromEntries(
    tickers.map((ticker) => [ticker, [] as number[]]),
  ) as Record<string, number[]>;

  for (const row of rows) {
    for (const ticker of tickers) {
      const value = row.returnsByTicker[ticker];

      if (value === undefined) {
        throw new Error(`Missing return for ticker ${ticker} on ${row.date}.`);
      }

      returnsByTicker[ticker].push(value);
    }
  }

  return returnsByTicker;
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

  const baseUrl = process.env.SPO_TOOLS_URL;
  if (!baseUrl) {
    throw new Error("SPO_TOOLS_URL environment variable is not set");
  }

  const response = await fetch(`${baseUrl}/returns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers: normalizedTickers, start: startDate, end: endDate }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`spo-tools /returns failed with status ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { rows: AlignedReturnRow[] };

  if (data.rows.length === 0) {
    throw new Error("No overlapping trading days found across tickers.");
  }

  return data.rows;
}

export async function fetchReturnsSinceDateForTickers(
  tickers: string[],
  startDate: string,
  endDate: string,
): Promise<AlignedReturnRow[]> {
  const startTimestamp = toUnixSeconds(startDate);

  const lookbackDate = new Date((startTimestamp - 14 * 24 * 60 * 60) * 1000)
    .toISOString()
    .slice(0, 10);

  const rows = await fetchAlignedReturnsForTickers(
    tickers,
    lookbackDate,
    endDate,
  );

  return rows.filter((row) => row.date >= startDate);
}
