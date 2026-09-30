import type { Evidence } from "./types";

// Codes and fields: https://fuyao.aicubes.cn/docs/api-reference/a-share-index/
export const INDEX_CODES = ["000001.SH", "000300.SH", "399006.SZ"] as const;
const INDEX_NAMES: Record<(typeof INDEX_CODES)[number], string> = {
  "000001.SH": "上证指数",
  "000300.SH": "沪深300",
  "399006.SZ": "创业板指",
};
export const FUYAO_INDEX_URL =
  "https://fuyao.aicubes.cn/api/a-share-index/prices/snapshot?thscodes=" +
  INDEX_CODES.join(",");

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Reject partial, conflicting, dateless, or non-finite snapshots before they become Evidence. */
export function parseIndexSnapshot(payload: unknown, now = Date.now()): Evidence {
  const envelope = record(payload);
  if (envelope?.code !== 0) throw new Error("provider_error");
  const data = record(envelope.data);
  const timestamp = data?.timestamp;
  if (!finite(timestamp) || timestamp <= 0 || timestamp > now + 60_000)
    throw new Error("invalid_timestamp");
  if (now - timestamp > 36 * 60 * 60 * 1_000)
    throw new Error("stale_snapshot");
  if (!Array.isArray(data?.item)) throw new Error("missing_items");

  const byCode = new Map<string, Record<string, unknown>>();
  for (const candidate of data.item) {
    const item = record(candidate);
    if (!item || typeof item.thscode !== "string") continue;
    if (!INDEX_CODES.includes(item.thscode as (typeof INDEX_CODES)[number]))
      continue;
    if (byCode.has(item.thscode)) throw new Error("duplicate_index");
    if (
      !finite(item.last_price) ||
      item.last_price <= 0 ||
      !finite(item.price_change_ratio_pct)
    )
      throw new Error("invalid_quote");
    byCode.set(item.thscode, item);
  }
  if (byCode.size !== INDEX_CODES.length) throw new Error("incomplete_snapshot");

  const quotes = INDEX_CODES.map((code) => {
    const row = byCode.get(code)!;
    return {
      thscode: code,
      name: INDEX_NAMES[code],
      last_price: row.last_price as number,
      price_change_ratio_pct: row.price_change_ratio_pct as number,
    };
  });
  const changes = quotes.map((q) => q.price_change_ratio_pct);
  const spread = Math.round((Math.max(...changes) - Math.min(...changes)) * 100) / 100;
  const signal =
    spread >= 1
      ? "divergent"
      : changes.every((n) => n < 0)
        ? "weak"
        : changes.every((n) => n >= 0)
          ? "consistent"
          : "neutral";
  const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  return {
    id: "E01",
    dimension: "market_structure",
    title: "三大指数表现差异",
    value: spread,
    unit: "个百分点",
    fact: quotes
      .map((q) => `${q.name} ${q.last_price.toFixed(2)} 点（${signed(q.price_change_ratio_pct)}）`)
      .join("；") + `。三者涨跌幅最大差为 ${spread.toFixed(2)} 个百分点。`,
    synthesis:
      signal === "divergent"
        ? "三只指数表现明显分化。"
        : signal === "weak"
          ? "三只指数均走弱，且表现差距较小。"
          : signal === "consistent"
            ? "三只指数方向较一致，且表现差距较小。"
            : "三只指数涨跌方向不完全一致，但表现差距较小。",
    source: "同花顺扶摇 · A 股指数行情快照",
    timestamp: new Date(timestamp).toISOString(),
    period: "最新行情快照",
    methodology:
      "上证指数、沪深300、创业板指的 price_change_ratio_pct 最大值减最小值；≥1 个百分点为明显分化。时间取扶摇 data.timestamp。",
    status: "valid",
    signal,
    raw: {
      timestamp,
      item: quotes.map(({ thscode, last_price, price_change_ratio_pct }) => ({
        thscode,
        last_price,
        price_change_ratio_pct,
      })),
    },
  };
}
