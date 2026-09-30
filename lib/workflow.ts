import { getFixture, DEMO_CLOCK, DEMO_TIME } from "./fixtures";
import { assess, buildPlan, parseIntent, validateEvidence } from "./engine";
import { Evidence, Report, Scenario } from "./types";
export const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export async function fetchEvidence(
  scenario: Scenario,
  mode: "mock" | "live",
  onAttempt: (n: number) => void = () => {},
  wait = pause,
  request: typeof fetch = fetch,
): Promise<Evidence[]> {
  if (mode === "live" && scenario === "normal") {
    const fixture = getFixture("normal");
    for (let attempt = 1; attempt <= 2; attempt++) {
      onAttempt(attempt);
      try {
        const response = await request("/api/index-structure", {
          signal: AbortSignal.timeout(7_000),
          cache: "no-store",
        });
        if (!response.ok) throw new Error("proxy_unavailable");
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object" || !("available" in payload) ||
            payload.available !== true || !("evidence" in payload))
          throw new Error("invalid_proxy_response");
        const e = payload.evidence as Evidence;
        if (e.id !== "E01" || e.dimension !== "market_structure" ||
            e.status !== "valid" || !e.source.startsWith("同花顺扶摇") ||
            !Number.isFinite(Date.parse(e.timestamp)))
          throw new Error("invalid_evidence");
        fixture[0] = e;
        return fixture;
      } catch {
        if (attempt < 2) await wait(200);
      }
    }
    fixture[0] = { ...fixture[0], fallback: true };
    return fixture;
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    onAttempt(attempt);
    try {
      await wait(350);
      if (scenario === "api_failure")
        throw new Error("Simulated provider unavailable");
      return getFixture(scenario);
    } catch {
      if (attempt === 2) return getFixture("api_failure");
      await wait(200);
    }
  }
  return getFixture("api_failure");
}
export async function runResearch(
  question: string,
  scenario: Scenario,
  mode: "mock" | "live",
  onProgress: (step: number, evidence?: Evidence[]) => void,
  onAttempt: (n: number) => void = () => {},
): Promise<Report> {
  const intent = parseIntent(question);
  if (!intent.allowed) throw new Error(intent.message);
  onProgress(0);
  const plan = buildPlan(question);
  await pause(400);
  onProgress(1);
  await pause(450);
  onProgress(2);
  const fetched = await fetchEvidence(scenario, mode, onAttempt);
  onProgress(3, fetched);
  await pause(450);
  const evidence = validateEvidence(
    fetched,
    new Date().toISOString(),
    DEMO_CLOCK,
  ).sort(
    (a, b) =>
      plan.dimensions.indexOf(a.dimension) -
      plan.dimensions.indexOf(b.dimension),
  );
  onProgress(4, evidence);
  const assessment = assess(evidence);
  await pause(350);
  return {
    question,
    scenario,
    mode,
    evidence,
    assessment,
    plan,
    createdAt: new Date().toISOString(),
    dataCutoff:
      evidence.find((e) => e.dimension === "market_structure" && !e.fallback &&
        e.source.startsWith("同花顺扶摇") && e.status === "valid")?.timestamp ?? DEMO_TIME,
  };
}
