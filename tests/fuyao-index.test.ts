import test from "node:test";
import assert from "node:assert/strict";
import { INDEX_CODES, FUYAO_INDEX_URL, parseIndexSnapshot } from "../lib/fuyao-index";
import { getFixture, DEMO_CLOCK } from "../lib/fixtures";
import { validateEvidence } from "../lib/engine";

const now = Date.parse("2026-09-30T12:00:00+08:00");
const sample = () => ({
  code: 0,
  data: {
    timestamp: now - 60_000,
    item: [
      { thscode: "000001.SH", last_price: 3400.12, price_change_ratio_pct: 0.35 },
      { thscode: "000300.SH", last_price: 3901.45, price_change_ratio_pct: 0.82 },
      { thscode: "399006.SZ", last_price: 2350.67, price_change_ratio_pct: -0.44 },
    ],
  },
});
test("official endpoint parameters and three index codes are explicit", () => {
  assert.deepEqual(INDEX_CODES, ["000001.SH", "000300.SH", "399006.SZ"]);
  assert.equal(new URL(FUYAO_INDEX_URL).searchParams.get("thscodes"), INDEX_CODES.join(","));
});
test("complete provider payload converts to traceable structure Evidence", () => {
  const e = parseIndexSnapshot(sample(), now);
  assert.equal(e.id, "E01");
  assert.equal(e.dimension, "market_structure");
  assert.equal(e.value, 1.26);
  assert.equal(e.unit, "个百分点");
  assert.equal(e.status, "valid");
  assert.equal(e.signal, "divergent");
  assert.equal(e.timestamp, new Date(now - 60_000).toISOString());
  assert.ok(e.source.startsWith("同花顺扶摇"));
  assert.match(e.period!, /快照/);
  assert.match(e.fact, /上证指数.*沪深300.*创业板指/);
  const mixed = getFixture("normal"); mixed[0] = e;
  const valid = validateEvidence(mixed, new Date(now).toISOString(), DEMO_CLOCK);
  assert.equal(valid.find(x=>x.dimension==="market_structure")?.status,"valid");
  assert.equal(valid.find(x=>x.dimension==="breadth")?.status,"valid");
});
test("partial, duplicate, stale and dateless responses cannot become real Evidence", () => {
  const missing = sample(); missing.data.item.pop();
  assert.throws(() => parseIndexSnapshot(missing, now), /incomplete_snapshot/);
  const duplicate = sample(); duplicate.data.item.push({...duplicate.data.item[0]});
  assert.throws(() => parseIndexSnapshot(duplicate, now), /duplicate_index/);
  const stale = sample(); stale.data.timestamp = now - 37 * 3600_000;
  assert.throws(() => parseIndexSnapshot(stale, now), /stale_snapshot/);
  const dateless:unknown = {code:0,data:{timestamp:null,item:sample().data.item}};
  assert.throws(() => parseIndexSnapshot(dateless, now), /invalid_timestamp/);
});
