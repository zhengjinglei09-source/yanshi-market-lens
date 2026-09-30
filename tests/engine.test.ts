import test from "node:test";
import assert from "node:assert/strict";
import {
  assess,
  breadthSignal,
  liquiditySignal,
  validateEvidence,
  parseIntent,
  buildPlan,
} from "../lib/engine";
import { getFixture, DEMO_CLOCK } from "../lib/fixtures";
import { fetchEvidence } from "../lib/workflow";

test("breadth and liquidity threshold boundaries are deterministic", () => {
  assert.equal(breadthSignal(60), "strong");
  assert.equal(breadthSignal(40), "neutral");
  assert.equal(breadthSignal(39.99), "weak");
  assert.equal(liquiditySignal(1.15), "active");
  assert.equal(liquiditySignal(0.85), "contracted");
  assert.equal(liquiditySignal(0.86), "neutral");
});
test("normal scenario is structure led with traceable conclusions", () => {
  const evidence = validateEvidence(getFixture("normal"), DEMO_CLOCK);
  const result = assess(evidence);
  assert.equal(result.state, "STRUCTURE_LED");
  assert.ok(result.confidence > 0 && result.confidence <= 100);
  for (const id of [
    ...result.evidenceIds,
    ...result.majorContradiction.evidenceIds,
    ...result.switchConditions.flatMap((c) => c.evidenceIds),
  ])
    assert.ok(evidence.some((e) => e.id === id && e.status === "valid"));
  assert.equal(result.switchConditions.length, 3);
});
for (const scenario of [
  "missing_breadth",
  "api_failure",
  "stale_data",
  "data_conflict",
] as const)
  test(`${scenario} never produces a normal state`, () => {
    const evidence = validateEvidence(getFixture(scenario), DEMO_CLOCK);
    const result = assess(evidence);
    assert.equal(result.state, "INSUFFICIENT_EVIDENCE");
    assert.equal(result.confidence, 0);
    assert.equal(result.switchConditions.length, 0);
  });
test("freshness, invalid numeric fields and duplicate dimensions fail closed", () => {
  let e = getFixture("normal");
  e[0].timestamp = "bad date";
  assert.equal(
    assess(validateEvidence(e, DEMO_CLOCK)).state,
    "INSUFFICIENT_EVIDENCE",
  );
  e = getFixture("normal");
  e.find((x) => x.dimension === "breadth")!.value = 101;
  assert.equal(
    assess(validateEvidence(e, DEMO_CLOCK)).state,
    "INSUFFICIENT_EVIDENCE",
  );
  e = getFixture("normal");
  e.push({ ...e[0], id: "duplicate" });
  assert.equal(
    assess(validateEvidence(e, DEMO_CLOCK)).state,
    "INSUFFICIENT_EVIDENCE",
  );
});
test("all four state candidates and tied evidence are reachable", () => {
  const cases = [
    {
      breadth: 70,
      structure: "consistent",
      liquidity: 1.2,
      sentiment: "active",
      style: 0,
      state: "BROAD_ACTIVE",
    },
    {
      breadth: 50,
      structure: "neutral",
      liquidity: 1,
      sentiment: "neutral",
      style: 0,
      state: "BALANCED",
    },
    {
      breadth: 30,
      structure: "weak",
      liquidity: 0.7,
      sentiment: "weak",
      style: 0,
      state: "RISK_CONTRACTION",
    },
  ];
  for (const c of cases) {
    const e = getFixture("normal");
    e.find((x) => x.dimension === "breadth")!.value = c.breadth;
    e.find((x) => x.dimension === "market_structure")!.signal = c.structure;
    e.find((x) => x.dimension === "liquidity")!.value = c.liquidity;
    e.find((x) => x.dimension === "sentiment")!.signal = c.sentiment;
    e.find((x) => x.dimension === "style")!.value = c.style;
    assert.equal(assess(validateEvidence(e, DEMO_CLOCK)).state, c.state);
  }
  const tied = getFixture("normal");
  tied.find((x) => x.dimension === "market_structure")!.signal = "weak";
  tied.find((x) => x.dimension === "liquidity")!.value = 0.96;
  assert.equal(
    assess(validateEvidence(tied, DEMO_CLOCK)).state,
    "INSUFFICIENT_EVIDENCE",
  );
});
test("compliance checks predictions, trades, positions, recommendations and returns before research", () => {
  for (const q of [
    "明天会上涨吗？",
    "下周会不会跌",
    "预测明日涨跌",
    "我要不要买？",
    "应该几成仓？",
    "推荐几只股票",
    "预计收益多少",
    "Will the market rise tomorrow?",
    "Should I buy now?",
    "帮我选股",
    "卖掉还是持有",
    "加仓吗",
  ])
    assert.equal(parseIntent(q).allowed, false, q);
  for (const q of [
    "当前 A 股处于什么状态？",
    "最近是普涨还是结构性行情？",
    "当前成长还是价值风格更强？",
    "当前最值得关注的风险变量是什么？",
  ])
    assert.equal(parseIntent(q).allowed, true, q);
  assert.notEqual(
    buildPlan("当前成长还是价值风格更强？").focus,
    buildPlan("当前最值得关注的风险变量是什么？").focus,
  );
  assert.equal(parseIntent("写一首诗").allowed, false);
});
test("provider failure retries and only the structure dimension falls back", async () => {
  const attempts: number[] = [];
  const unavailable = async () => { throw new Error("offline"); };
  const live = await fetchEvidence("normal", "live", n => attempts.push(n), async () => {}, unavailable as typeof fetch);
  assert.deepEqual(attempts, [1, 2]);
  assert.equal(live[0].fallback, true);
  assert.ok(live.every(e => e.source.startsWith("DEMO")));
  assert.equal(live.find(e=>e.dimension==="breadth")?.status,"valid");
  const failures = await fetchEvidence("api_failure", "live", () => {}, async () => {}, unavailable as typeof fetch);
  assert.ok(failures.every(e => e.status === "missing"));
});
