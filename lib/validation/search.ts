// TODO: Implement in Step 13 with real Zod schema.
// This stub satisfies TypeScript during test-first (Step 5).
// Tests will fail at runtime until the real implementation is added.

type ParseIssue = { path: (string | number)[]; message: string };
type ParseSuccess = { success: true; data: { origin: string; destination: string; date: string; ticketCount: number } };
type ParseFailure = { success: false; error: { issues: ParseIssue[] } };
type ParseResult = ParseSuccess | ParseFailure;

export const searchParamsSchema = {
  safeParse: (_data: unknown): ParseResult => ({
    success: false,
    error: { issues: [] },
  }),
};
