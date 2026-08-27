import { z } from "zod";

export const algorithmSchema = z.enum(["spgd", "prox-svrg", "prox-sarah", "prox-storm"]);

export const optimizeRequestSchema = z
  .object({
    tickers: z
      .array(z.string().regex(/^[A-Z.]{1,10}$/, "Tickers must be 1-10 uppercase letters/dots"))
      .min(2, "Enter at least 2 tickers")
      .max(30, "30 tickers maximum"),
    start: z.string().date(),
    end: z.string().date(),
    algorithm: algorithmSchema.default("prox-svrg"),
    gamma: z.number().min(0.1).max(10).default(2.0),
    lambda: z.number().min(0).max(1).default(0.01),
  })
  .refine((data) => data.start < data.end, {
    message: "Start date must be before end date",
    path: ["start"],
  });

export type OptimizeRequestInput = z.infer<typeof optimizeRequestSchema>;

export const savePortfolioSchema = z.object({
  name: z.string().min(1, "Name your portfolio").max(80),
  request: optimizeRequestSchema,
  result: z.object({
    weights: z.array(z.object({ ticker: z.string(), weight: z.number() })),
    finalObjective: z.number(),
    sparsityPct: z.number(),
  }),
});

export type SavePortfolioInput = z.infer<typeof savePortfolioSchema>;
