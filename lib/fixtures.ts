import { Evidence, Scenario } from "./types";
export const DEMO_TIME = "2026-09-28T15:00:00+08:00";
export const DEMO_CLOCK = "2026-09-28T15:15:00+08:00";
const common = {
  source: "DEMO · 研势合成数据集 v1",
  timestamp: DEMO_TIME,
  status: "valid" as const,
};
const fixture: Evidence[] = [
  {
    ...common,
    id: "E01",
    dimension: "market_structure",
    title: "主要指数表现分化",
    value: 1.92,
    unit: "个百分点",
    signal: "divergent",
    fact: "模拟样本中，成长指数 +1.24%，价值指数 −0.68%，表现相差 1.92 个百分点。",
    synthesis: "指数表现分化，整体方向并不一致。",
    period: "演示当日收盘",
    methodology:
      "两个合成风格指数日收益率之差。差值 ≥ 1 个百分点定义为明显分化；非官方指数行情。",
    raw: {
      growth_index_return_pct: 1.24,
      value_index_return_pct: -0.68,
      spread_pp: 1.92,
    },
  },
  {
    ...common,
    id: "E02",
    dimension: "breadth",
    title: "上涨股票占比",
    value: 36.8,
    unit: "%",
    fact: "模拟有效样本 5,000 只，其中 1,840 只上涨，上涨占比为 36.8%。",
    synthesis: "上涨覆盖范围偏低，市场参与程度有限。",
    period: "演示当日收盘",
    methodology:
      "上涨股票数 / 有效股票数；模拟样本剔除停牌及无有效前收盘价股票，平盘计入分母。",
    raw: {
      advancing: 1840,
      valid_sample: 5000,
      declining: 2890,
      unchanged: 270,
    },
  },
  {
    ...common,
    id: "E03",
    dimension: "style",
    title: "成长相对价值表现",
    value: 2.6,
    unit: "个百分点",
    fact: "近 5 个模拟交易日，成长风格 +3.2%，价值风格 +0.6%，差值为 2.6 个百分点。",
    synthesis: "成长风格相对占优，是当前结构的主要解释变量。",
    period: "近 5 个模拟交易日",
    methodology:
      "合成成长与价值指数区间收益率差；绝对差值 ≥ 1 个百分点视为明显风格优势。",
    raw: { growth_5d_pct: 3.2, value_5d_pct: 0.6, relative_pp: 2.6 },
  },
  {
    ...common,
    id: "E04",
    dimension: "liquidity",
    title: "成交额 / 20 日均额",
    value: 0.96,
    unit: "倍",
    fact: "模拟成交额 9,600 亿元，20 日平均成交额 10,000 亿元，比值为 0.96。",
    synthesis: "流动性处于中性区间，尚未显示明显扩张。",
    period: "当日 / 前 20 个模拟交易日",
    methodology:
      "当日 A 股模拟成交额 / 前 20 个模拟交易日成交额均值；≤0.85 收缩，≥1.15 活跃。",
    raw: { turnover_billion_cny: 960, mean20_billion_cny: 1000, ratio: 0.96 },
  },
  {
    ...common,
    id: "E05",
    dimension: "sentiment",
    title: "涨跌停数量比",
    value: 1.3,
    unit: "倍",
    signal: "neutral",
    fact: "模拟涨停 39 只、跌停 30 只，数量比为 1.30。",
    synthesis: "情绪信号中性，未形成广泛活跃的支持证据。",
    period: "演示当日收盘",
    methodology:
      "涨停家数 / 跌停家数；MVP 示例阈值 ≥2 活跃、<0.8 偏弱、其余中性。真实接入须处理无涨跌幅限制样本与零分母。",
    raw: { limit_up: 39, limit_down: 30, ratio: 1.3 },
  },
  {
    ...common,
    id: "E06",
    dimension: "valuation",
    title: "全市场估值分位",
    value: 54,
    unit: "%",
    fact: "合成估值序列中，当前市盈率位于近 3 年样本的第 54 百分位。",
    synthesis: "估值作为背景信息，不单独决定市场状态。",
    period: "近 3 年模拟样本",
    methodology:
      "合成全市场 PE（TTM）的经验分位；仅用于证据展示，不对应实际 A 股估值。",
    raw: { percentile: 54, lookback_years: 3 },
  },
  {
    ...common,
    id: "E07",
    dimension: "events",
    title: "重要事件核验",
    value: "未接入",
    status: "missing",
    fact: "当前演示未接入公告、新闻与交易日历数据。",
    synthesis: "数据暂不可用，本次判断未使用该维度。",
    period: "本次研究",
    methodology: "未调用真实事件接口；不将缺失解释为“无重要事件”。",
    issue: "重要事件数据暂不可用。",
  },
];
export function getFixture(scenario: Scenario): Evidence[] {
  const e = structuredClone(fixture);
  if (scenario === "missing_breadth")
    Object.assign(e[1], {
      status: "missing",
      value: undefined,
      raw: undefined,
      fact: "数据暂不可用，本次判断未使用该维度。",
      issue: "市场宽度数据暂不可用。",
    });
  if (scenario === "api_failure")
    return e.map((x) => ({
      ...x,
      status: "missing",
      value: undefined,
      raw: undefined,
      fact: "模拟数据提供方请求失败，重试后仍不可用。",
      issue: "Unavailable · 数据接口失败。",
    }));
  if (scenario === "stale_data")
    Object.assign(e[1], { timestamp: "2026-09-20T15:00:00+08:00" });
  if (scenario === "data_conflict")
    Object.assign(e[1], {
      status: "conflict",
      value: "36.8 / 62.4",
      fact: "两个模拟来源对同一口径分别返回 36.8% 与 62.4%，当前数据存在冲突。",
      issue: "相同指标的来源值冲突，不自动选择其中一个。",
      raw: { demo_source_a: 36.8, demo_source_b: 62.4 },
    });
  return e;
}
