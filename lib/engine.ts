import { DIMENSIONS, Evidence, MarketAssessment, ResearchPlan } from "./types";
const core = ["market_structure", "breadth", "liquidity", "sentiment"];
export function breadthSignal(n: number) {
  return n >= 60 ? "strong" : n >= 40 ? "neutral" : "weak";
}
export function liquiditySignal(n: number) {
  return n >= 1.15 ? "active" : n <= 0.85 ? "contracted" : "neutral";
}
export function parseIntent(question: string) {
  const q = question.trim();
  if (!q || q.length > 300)
    return { allowed: false, message: "请输入 1–300 字的市场研究问题。" };
  if (
    /买|卖|仓位|几成仓|加仓|减仓|建仓|清仓|重仓|满仓|持有|选股|推荐.*股|荐股|收益|回报|赚多少|buy|sell|position|recommend.*stock|return on/i.test(
      q,
    )
  )
    return {
      allowed: false,
      message:
        "研势不提供具体买卖、选股、收益或仓位建议。我可以帮助你分析当前市场的主要矛盾与风险变量。",
    };
  if (
    /预测|目标价|会.*[涨跌]|能.*[涨跌]|[涨跌].*概率|明[天日]|下周|下个月|未来.*[涨跌]|forecast|predict|tomorrow|will.*(rise|fall|up|down)/i.test(
      q,
    )
  )
    return {
      allowed: false,
      message:
        "研势不提供确定性涨跌预测。我可以帮助你理解当前市场状态以及哪些条件可能改变当前判断。",
    };
  if (
    !/市场|股|大盘|行情|成长|价值|风格|风险|行业|流动性|估值|情绪|market|liquidity|breadth/i.test(
      q,
    )
  )
    return {
      allowed: false,
      message:
        "研势专注 A 股市场状态研究。可以从市场结构、风格或风险变量开始。",
    };
  return { allowed: true, message: "" };
}
export function buildPlan(q: string): ResearchPlan {
  const focus = /风险|流动性|情绪/.test(q)
    ? "风险变量"
    : /风格|成长|价值/.test(q)
      ? "市场风格"
      : /行业/.test(q)
        ? "行业结构"
        : "市场全景";
  const dimensions = Object.keys(DIMENSIONS) as ResearchPlan["dimensions"];
  if (focus === "市场风格")
    dimensions.sort((a, b) => Number(b === "style") - Number(a === "style"));
  if (focus === "风险变量")
    dimensions.sort(
      (a, b) =>
        Number(["breadth", "liquidity", "sentiment"].includes(b)) -
        Number(["breadth", "liquidity", "sentiment"].includes(a)),
    );
  return {
    focus,
    dimensions,
    explanation:
      focus === "行业结构"
        ? "当前未接入行业成分与行业表现数据；仅展示全市场结构背景，不生成行业排名。"
        : `优先观察${focus === "市场风格" ? "成长与价值差异，再用市场宽度检验参与范围" : focus === "风险变量" ? "市场宽度、流动性与情绪的交叉信号" : "行情结构、市场宽度、流动性与情绪"}；估值与事件仅作为背景。`,
  };
}
export function validateEvidence(
  items: Evidence[],
  clock: string,
  demoClock?: string,
): Evidence[] {
  const now = Date.parse(clock);
  return items.map((item) => {
    const e = { ...item };
    if (e.status !== "valid") return e;
    if (items.filter((x) => x.dimension === e.dimension).length > 1)
      return {
        ...e,
        status: "conflict",
        issue: "同一维度存在重复证据，需人工核验。",
      };
    const referenceTime = demoClock && e.source.startsWith("DEMO")
      ? Date.parse(demoClock)
      : now;
    const t = Date.parse(e.timestamp);
    if (!Number.isFinite(t) || !Number.isFinite(referenceTime) || t > referenceTime + 60000)
      return {
        ...e,
        status: "conflict",
        issue: "数据时间无效或晚于校验时间。",
      };
    if (referenceTime - t > 36 * 3600 * 1000)
      return { ...e, status: "stale", issue: "数据已过期，不进入核心判断。" };
    if (!e.source || e.value === undefined)
      return { ...e, status: "missing", issue: "数值或来源缺失。" };
    if (
      ["breadth", "liquidity", "style", "valuation"].includes(e.dimension) &&
      (typeof e.value !== "number" || !Number.isFinite(e.value))
    )
      return { ...e, status: "conflict", issue: "指标数值类型异常。" };
    if (
      ((e.dimension === "breadth" || e.dimension === "valuation") &&
        (Number(e.value) < 0 || Number(e.value) > 100)) ||
      (e.dimension === "liquidity" && Number(e.value) < 0)
    )
      return { ...e, status: "conflict", issue: "指标数值超出有效范围。" };
    if (
      e.dimension === "market_structure" &&
      !["consistent", "divergent", "neutral", "weak"].includes(e.signal ?? "")
    )
      return { ...e, status: "missing", issue: "行情结构信号未提供。" };
    if (
      e.dimension === "sentiment" &&
      !["active", "neutral", "weak"].includes(e.signal ?? "")
    )
      return { ...e, status: "missing", issue: "情绪信号未提供。" };
    return e;
  });
}
export function assess(evidence: Evidence[]): MarketAssessment {
  const valid = evidence.filter((e) => e.status === "valid");
  const get = (d: string) => valid.find((e) => e.dimension === d);
  const caveats = evidence
    .filter((e) => e.status !== "valid")
    .map(
      (e) =>
        `${DIMENSIONS[e.dimension]}：${e.issue ?? "数据暂不可用，本次判断未使用该维度。"}`,
    );
  const empty = (
    reason: string,
    scores: Record<string, number> = {},
  ): MarketAssessment => ({
    state: "INSUFFICIENT_EVIDENCE",
    summary: "当前证据不足，暂不形成市场状态判断。",
    evidenceIds: valid.map((e) => e.id),
    confidence: 0,
    confidenceFactors: ["关键证据不足或候选状态冲突，不计算置信度。"],
    tags: ["等待证据补齐"],
    scores,
    majorContradiction: {
      title: "暂无法可靠提炼主要矛盾",
      explanation: reason,
      evidenceIds: valid.map((e) => e.id),
    },
    switchConditions: [],
    caveats: [reason, ...caveats],
  });
  if (core.some((d) => !get(d)))
    return empty(
      "行情结构、市场宽度、流动性、情绪四项核心证据必须完整且有效。",
    );
  const breadth = breadthSignal(Number(get("breadth")!.value)),
    liquidity = liquiditySignal(Number(get("liquidity")!.value)),
    structure = get("market_structure")!.signal,
    sentiment = get("sentiment")!.signal;
  const style = get("style"),
    styleLead = style ? Math.abs(Number(style.value)) >= 1 : false;
  const scores = {
    BROAD_ACTIVE:
      (breadth === "strong" ? 3 : 0) +
      (liquidity === "active" ? 2 : 0) +
      (structure === "consistent" ? 2 : 0) +
      (sentiment === "active" ? 1 : 0),
    STRUCTURE_LED:
      (breadth !== "strong" ? 2 : 0) +
      (structure === "divergent" ? 2 : 0) +
      (styleLead ? 3 : 0),
    BALANCED:
      (breadth === "neutral" ? 2 : 0) +
      (structure === "neutral" ? 2 : 0) +
      (liquidity === "neutral" ? 1 : 0) +
      (style && !styleLead ? 2 : 0),
    RISK_CONTRACTION:
      (breadth === "weak" ? 3 : 0) +
      (structure === "weak" ? 2 : 0) +
      (liquidity === "contracted" ? 2 : 0) +
      (sentiment === "weak" ? 2 : 0),
  };
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const margin = sorted[0][1] - sorted[1][1];
  if (sorted[0][1] < 4 || margin < 2)
    return empty(
      "候选状态分差不足 2 分或最高分不足 4 分，现有证据无法清晰区分状态。",
      scores,
    );
  const state = sorted[0][0] as MarketAssessment["state"];
  const ids = (...dims: string[]) =>
    valid.filter((e) => dims.includes(e.dimension)).map((e) => e.id);
  const styleName = Number(style?.value) >= 0 ? "成长" : "价值";
  const factors = ["基础分 50", "四项核心证据完整 +20"];
  let confidence = 70;
  if (margin >= 3) {
    confidence += 20;
    factors.push("候选状态领先至少 3 分 +20");
  }
  confidence += 10;
  factors.push("有效证据均在时效窗口内 +10");
  for (const [status, penalty, label] of [
    ["missing", 15, "数据缺失"],
    ["conflict", 15, "数据冲突"],
    ["stale", 20, "数据过期"],
  ] as const) {
    if (evidence.some((e) => e.status === status)) {
      confidence -= penalty;
      factors.push(`${label} −${penalty}`);
    }
  }
  const summaries = {
    BROAD_ACTIVE: "市场参与范围较广，多项核心信号共同支持活跃状态。",
    STRUCTURE_LED: "行情更多集中于部分方向，市场参与范围尚未同步扩大。",
    BALANCED: "市场内部力量相对均衡，当前没有明显一致方向。",
    RISK_CONTRACTION: "市场宽度与其他核心信号共同反映风险偏好收缩。",
    INSUFFICIENT_EVIDENCE: "",
  };
  const contradiction =
    styleLead && breadth !== "strong"
      ? {
          title: `${styleName}方向表现占优，但市场参与范围没有同步扩大。`,
          explanation: `风格差异为局部结构提供解释，而上涨股票占比未达到广泛参与的阈值，因此不能将局部优势等同于全市场活跃。`,
          evidenceIds: ids("style", "breadth"),
        }
      : structure === "divergent" && liquidity === "neutral"
        ? {
            title: "指数表现分化，但成交活跃度仍处于中性。",
            explanation: "指数间的差异尚未得到成交额扩张的共同支持。",
            evidenceIds: ids("market_structure", "liquidity"),
          }
        : {
            title: "核心证据方向较一致，尚未识别到显著矛盾。",
            explanation:
              "现有有效信号未构成明显不一致，不人为制造矛盾。仍需观察市场宽度与流动性的后续证据。",
            evidenceIds: ids("breadth", "liquidity"),
          };
  const conditions = [
    {
      condition:
        breadth === "strong"
          ? "上涨股票占比回落至 60% 以下，且行情结构由一致转为分化。"
          : "上涨股票占比达到 60% 或以上，且行情结构转为较一致。",
      evidenceIds: ids("breadth", "market_structure"),
    },
    {
      condition:
        liquidity === "contracted"
          ? "成交额 / 20 日均额回升至 0.85 以上，且情绪不再偏弱。"
          : "成交额 / 20 日均额降至 0.85 或以下，且情绪转为偏弱。",
      evidenceIds: ids("liquidity", "sentiment"),
    },
    ...(style
      ? [
          {
            condition: styleLead
              ? "成长与价值的近 5 日表现差绝对值降至 1 个百分点以下，且市场宽度扩大。"
              : "成长与价值的近 5 日表现差绝对值达到 1 个百分点，且指数明显分化。",
            evidenceIds: ids(
              "style",
              styleLead ? "breadth" : "market_structure",
            ),
          },
        ]
      : []),
  ].map((c) => ({ ...c, implication: "需要重新评估当前判断。" }));
  return {
    state,
    summary: summaries[state],
    evidenceIds: ids(...core, ...(style ? ["style"] : [])),
    confidence: Math.max(0, Math.min(100, confidence)),
    confidenceFactors: factors,
    tags: [
      ...(styleLead ? [`${styleName}占优`] : []),
      `市场宽度${breadth === "weak" ? "偏弱" : breadth === "strong" ? "较强" : "中性"}`,
      `流动性${liquidity === "neutral" ? "中性" : liquidity === "active" ? "活跃" : "收缩"}`,
    ],
    scores,
    majorContradiction: contradiction,
    switchConditions: conditions,
    caveats,
  };
}
