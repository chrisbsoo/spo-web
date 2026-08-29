import { afterEach, describe, expect, it, vi } from "vitest";

import {
  alignReturnsByTicker,
  calculateAlignedReturnsFromPrices,
  calculateDatedLogReturns,
  calculateLogReturns,
  fetchAdjustedClosePrices,
  fetchAlignedReturnsForTickers,
} from "../lib/drift/market-data";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("calculateLogReturns", () => {
  it("calculates daily log returns", () => {
    const prices = [100, 110, 121];

    const result = calculateLogReturns(prices);

    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(Math.log(110 / 100));
    expect(result[1]).toBeCloseTo(Math.log(121 / 110));
  });

  it("returns zero when consecutive prices are unchanged", () => {
    const result = calculateLogReturns([100, 100]);

    expect(result).toEqual([0]);
  });

  it("throws when fewer than two prices are provided", () => {
    expect(() => calculateLogReturns([100])).toThrow(
      "At least two prices are required to calculate returns.",
    );

    expect(() => calculateLogReturns([])).toThrow(
      "At least two prices are required to calculate returns.",
    );
  });

  it("rejects non-positive prices", () => {
    expect(() => calculateLogReturns([100, 0])).toThrow(
      "Prices must be finite positive numbers.",
    );

    expect(() => calculateLogReturns([100, -5])).toThrow(
      "Prices must be finite positive numbers.",
    );
  });

  it("rejects non-finite prices", () => {
    expect(() => calculateLogReturns([100, NaN])).toThrow(
      "Prices must be finite positive numbers.",
    );

    expect(() => calculateLogReturns([100, Infinity])).toThrow(
      "Prices must be finite positive numbers.",
    );
  });
});

describe("calculateDatedLogReturns", () => {
  it("associates each log return with the later price date", () => {
    const result = calculateDatedLogReturns([
      {
        date: "2024-01-02",
        adjustedClose: 100,
      },
      {
        date: "2024-01-03",
        adjustedClose: 110,
      },
      {
        date: "2024-01-04",
        adjustedClose: 121,
      },
    ]);

    expect(result).toHaveLength(2);

    expect(result[0].date).toBe("2024-01-03");
    expect(result[0].logReturn).toBeCloseTo(Math.log(110 / 100));

    expect(result[1].date).toBe("2024-01-04");
    expect(result[1].logReturn).toBeCloseTo(Math.log(121 / 110));
  });
});

describe("calculateAlignedReturnsFromPrices", () => {
  it("drops intervals when any ticker is missing either endpoint", () => {
    const result = calculateAlignedReturnsFromPrices({
      AAPL: [
        {
          date: "2024-01-02",
          adjustedClose: 100,
        },
        {
          date: "2024-01-03",
          adjustedClose: 110,
        },
        {
          date: "2024-01-04",
          adjustedClose: 120,
        },
        {
          date: "2024-01-05",
          adjustedClose: 130,
        },
      ],
      MSFT: [
        {
          date: "2024-01-02",
          adjustedClose: 200,
        },
        {
          date: "2024-01-03",
          adjustedClose: 220,
        },
        {
          date: "2024-01-05",
          adjustedClose: 242,
        },
      ],
    });

    expect(result).toHaveLength(1);

    expect(result[0].date).toBe("2024-01-03");

    expect(result[0].returnsByTicker.AAPL).toBeCloseTo(Math.log(110 / 100));

    expect(result[0].returnsByTicker.MSFT).toBeCloseTo(Math.log(220 / 200));
  });
});

describe("alignReturnsByTicker", () => {
  it("keeps only dates shared by every ticker", () => {
    const result = alignReturnsByTicker({
      AAPL: [
        {
          date: "2024-01-03",
          logReturn: 0.01,
        },
        {
          date: "2024-01-04",
          logReturn: 0.02,
        },
        {
          date: "2024-01-05",
          logReturn: 0.03,
        },
      ],
      MSFT: [
        {
          date: "2024-01-03",
          logReturn: 0.04,
        },
        {
          date: "2024-01-04",
          logReturn: 0.05,
        },
      ],
    });

    expect(result).toEqual([
      {
        date: "2024-01-03",
        returnsByTicker: {
          AAPL: 0.01,
          MSFT: 0.04,
        },
      },
      {
        date: "2024-01-04",
        returnsByTicker: {
          AAPL: 0.02,
          MSFT: 0.05,
        },
      },
    ]);
  });
  it("rejects an empty set of ticker return series", () => {
    expect(() => alignReturnsByTicker({})).toThrow(
      "At least one ticker return series is required.",
    );
  });

  it("rejects ticker series with no common dates", () => {
    expect(() =>
      alignReturnsByTicker({
        AAPL: [
          {
            date: "2024-01-03",
            logReturn: 0.01,
          },
        ],
        MSFT: [
          {
            date: "2024-01-04",
            logReturn: 0.02,
          },
        ],
      }),
    ).toThrow("No common return dates found across tickers.");
  });
});

describe("fetchAlignedReturnsForTickers", () => {
  it("rejects an empty ticker list", async () => {
    await expect(
      fetchAlignedReturnsForTickers([], "2024-01-01", "2024-01-05"),
    ).rejects.toThrow("At least one ticker is required.");
  });

  it("rejects empty ticker values", async () => {
    await expect(
      fetchAlignedReturnsForTickers(
        ["AAPL", "   "],
        "2024-01-01",
        "2024-01-05",
      ),
    ).rejects.toThrow("Tickers cannot be empty.");
  });

  it("rejects duplicate tickers after normalization", async () => {
    await expect(
      fetchAlignedReturnsForTickers(
        ["AAPL", "aapl"],
        "2024-01-01",
        "2024-01-05",
      ),
    ).rejects.toThrow("Tickers must be unique.");
  });
  it("fetches, calculates, and aligns returns for multiple tickers", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  timestamp: [1704153600, 1704240000, 1704326400],
                  indicators: {
                    adjclose: [
                      {
                        adjclose: [100, 110, 121],
                      },
                    ],
                  },
                },
              ],
              error: null,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  timestamp: [1704153600, 1704240000, 1704326400],
                  indicators: {
                    adjclose: [
                      {
                        adjclose: [200, 220, 242],
                      },
                    ],
                  },
                },
              ],
              error: null,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAlignedReturnsForTickers(
      ["aapl", "msft"],
      "2024-01-02",
      "2024-01-04",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(result).toHaveLength(2);

    expect(result[0].date).toBe("2024-01-03");
    expect(result[0].returnsByTicker.AAPL).toBeCloseTo(Math.log(110 / 100));
    expect(result[0].returnsByTicker.MSFT).toBeCloseTo(Math.log(220 / 200));

    expect(result[1].date).toBe("2024-01-04");
    expect(result[1].returnsByTicker.AAPL).toBeCloseTo(Math.log(121 / 110));
    expect(result[1].returnsByTicker.MSFT).toBeCloseTo(Math.log(242 / 220));
  });
});

describe("fetchAdjustedClosePrices", () => {
  it("fetches and parses adjusted close prices", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                timestamp: [1577836800, 1577923200, 1578009600],
                indicators: {
                  adjclose: [
                    {
                      adjclose: [100, 101, 102],
                    },
                  ],
                },
              },
            ],
            error: null,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAdjustedClosePrices(
      "aapl",
      "2020-01-01",
      "2020-01-03",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestedUrl = fetchMock.mock.calls[0][0];

    expect(requestedUrl).toBeInstanceOf(URL);

    const url = requestedUrl as URL;

    expect(url.pathname).toBe("/v8/finance/chart/AAPL");
    expect(url.searchParams.get("period1")).toBe("1577836800");
    expect(url.searchParams.get("period2")).toBe("1578009600");
    expect(url.searchParams.get("interval")).toBe("1d");
    expect(url.searchParams.get("events")).toBe("history");
    expect(url.searchParams.get("includeAdjustedClose")).toBe("true");

    expect(result).toEqual([
      {
        date: "2020-01-01",
        adjustedClose: 100,
      },
      {
        date: "2020-01-02",
        adjustedClose: 101,
      },
      {
        date: "2020-01-03",
        adjustedClose: 102,
      },
    ]);
  });

  it("rejects an empty ticker", async () => {
    await expect(
      fetchAdjustedClosePrices("   ", "2020-01-01", "2020-01-03"),
    ).rejects.toThrow("Ticker cannot be empty.");
  });

  it("rejects invalid dates", async () => {
    await expect(
      fetchAdjustedClosePrices("AAPL", "2020-02-30", "2020-03-03"),
    ).rejects.toThrow("Invalid date: 2020-02-30");
  });

  it("rejects a start date that is not before the end date", async () => {
    await expect(
      fetchAdjustedClosePrices("AAPL", "2020-01-03", "2020-01-03"),
    ).rejects.toThrow("Start date must be before end date.");
  });

  it("throws when the Yahoo Finance request fails", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 500,
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAdjustedClosePrices("AAPL", "2020-01-01", "2020-01-03"),
    ).rejects.toThrow("Yahoo Finance request failed with status 500.");
  });

  it("throws when Yahoo Finance returns an API error", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          chart: {
            result: null,
            error: {
              code: "Not Found",
              description: "No data found",
            },
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAdjustedClosePrices("INVALID", "2020-01-01", "2020-01-03"),
    ).rejects.toThrow("Yahoo Finance error: No data found");
  });

  it("throws when fewer than two valid prices are returned", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                timestamp: [1577836800],
                indicators: {
                  adjclose: [
                    {
                      adjclose: [100],
                    },
                  ],
                },
              },
            ],
            error: null,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAdjustedClosePrices("AAPL", "2020-01-01", "2020-01-03"),
    ).rejects.toThrow("Insufficient market data found for AAPL.");
  });
});
