import { afterEach, describe, expect, it, vi } from "vitest";

import {
  alignReturnsByTicker,
  calculateAlignedReturnsFromPrices,
  calculateDatedLogReturns,
  calculateLogReturns,
  fetchAlignedReturnsForTickers,
  fetchReturnsSinceDateForTickers,
  groupAlignedReturnsByTicker,
} from "../lib/drift/market-data";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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

describe("groupAlignedReturnsByTicker", () => {
  it("groups aligned return rows into ticker return arrays", () => {
    const result = groupAlignedReturnsByTicker([
      {
        date: "2024-01-03",
        returnsByTicker: {
          AAPL: 0.01,
          MSFT: 0.02,
        },
      },
      {
        date: "2024-01-04",
        returnsByTicker: {
          AAPL: -0.005,
          MSFT: 0.008,
        },
      },
    ]);

    expect(result).toEqual({
      AAPL: [0.01, -0.005],
      MSFT: [0.02, 0.008],
    });
  });

  it("rejects a later row that is missing a ticker", () => {
    expect(() =>
      groupAlignedReturnsByTicker([
        {
          date: "2024-01-03",
          returnsByTicker: {
            AAPL: 0.01,
            MSFT: 0.02,
          },
        },
        {
          date: "2024-01-04",
          returnsByTicker: {
            AAPL: -0.005,
          },
        },
      ]),
    ).toThrow("Missing return for ticker MSFT on 2024-01-04.");
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
  it("fetches, calculates, and aligns returns for multiple tickers via spo-tools", async () => {
    vi.stubEnv("SPO_TOOLS_URL", "https://spo-tools.example.com");

    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          rows: [
            {
              date: "2024-01-03",
              returnsByTicker: { AAPL: Math.log(110 / 100), MSFT: Math.log(220 / 200) },
            },
            {
              date: "2024-01-04",
              returnsByTicker: { AAPL: Math.log(121 / 110), MSFT: Math.log(242 / 220) },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAlignedReturnsForTickers(["aapl", "msft"], "2024-01-02", "2024-01-04");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://spo-tools.example.com/returns");
    expect(JSON.parse(init?.body as string)).toEqual({
      tickers: ["AAPL", "MSFT"],
      start: "2024-01-02",
      end: "2024-01-04",
    });

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2024-01-03");
    expect(result[0].returnsByTicker.AAPL).toBeCloseTo(Math.log(110 / 100));
    expect(result[0].returnsByTicker.MSFT).toBeCloseTo(Math.log(220 / 200));
    expect(result[1].date).toBe("2024-01-04");
    expect(result[1].returnsByTicker.AAPL).toBeCloseTo(Math.log(121 / 110));
    expect(result[1].returnsByTicker.MSFT).toBeCloseTo(Math.log(242 / 220));
  });

  it("throws when SPO_TOOLS_URL is not set", async () => {
    vi.stubEnv("SPO_TOOLS_URL", "");

    await expect(
      fetchAlignedReturnsForTickers(["AAPL", "MSFT"], "2024-01-01", "2024-01-05"),
    ).rejects.toThrow("SPO_TOOLS_URL environment variable is not set");
  });

  it("throws when spo-tools returns a non-ok response", async () => {
    vi.stubEnv("SPO_TOOLS_URL", "https://spo-tools.example.com");
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(new Response("upstream error", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAlignedReturnsForTickers(["AAPL", "MSFT"], "2024-01-01", "2024-01-05"),
    ).rejects.toThrow(/spo-tools \/returns failed with status 502/);
  });
});

describe("fetchReturnsSinceDateForTickers", () => {
    it("keeps only returns on or after the monitoring start date", async () => {
    vi.stubEnv("SPO_TOOLS_URL", "https://spo-tools.example.com");

    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          rows: [
            { date: "2024-01-03", returnsByTicker: { AAPL: Math.log(101 / 100) } },
            { date: "2024-01-04", returnsByTicker: { AAPL: Math.log(102 / 101) } },
            { date: "2024-01-05", returnsByTicker: { AAPL: Math.log(104 / 102) } },
            { date: "2024-01-08", returnsByTicker: { AAPL: Math.log(108 / 104) } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchReturnsSinceDateForTickers(["AAPL"], "2024-01-05", "2024-01-09");

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2024-01-05");
    expect(result[0].returnsByTicker.AAPL).toBeCloseTo(Math.log(104 / 102));
    expect(result[1].date).toBe("2024-01-08");
    expect(result[1].returnsByTicker.AAPL).toBeCloseTo(Math.log(108 / 104));
  });
});
