export type Dimension =
  | "market_structure"
  | "breadth"
  | "style"
  | "valuation"
  | "liquidity"
  | "sentiment"
  | "events";
export type Scenario =
  "normal" | "missing_breadth" | "api_failure" | "stale_data" | "data_conflict";
export type Evidence = {
  id: string;
  dimension: Dimension;
  title: string;
  value?: number | string;
  unit?: string;
  fact: string;
  synthesis?: string;
  source: string;
  timestamp: string;
  period?: string;
  methodology?: string;
  status: "valid" | "missing" | "stale" | "conflict";
  signal?: string;
  raw?: Record<string, unknown>;
  issue?: string;
  fallback?: boolean;
};
export type State =
  | "BROAD_ACTIVE"
  | "STRUCTURE_LED"
  | "BALANCED"
  | "RISK_CONTRACTION"
  | "INSUFFICIENT_EVIDENCE";
export type MarketAssessment = {
  state: State;
  summary: string;
  evidenceIds: string[];
  confidence: number;
  confidenceFactors: string[];
  tags: string[];
  scores: Record<string, number>;
  majorContradiction: {
    title: string;
    explanation: string;
    evidenceIds: string[];
  };
  switchConditions: {
    condition: string;
    implication: string;
    evidenceIds: string[];
  }[];
  caveats: string[];
};
export type ResearchPlan = {
  focus: string;
  dimensions: Dimension[];
  explanation: string;
};
export type Report = {
  question: string;
  scenario: Scenario;
  mode: "mock" | "live";
  evidence: Evidence[];
  assessment: MarketAssessment;
  plan: ResearchPlan;
  createdAt: string;
  dataCutoff: string;
};
export const DIMENSIONS: Record<Dimension, string> = {
  market_structure: "行情结构",
  breadth: "市场宽度",
  style: "风格轮动",
  valuation: "估值",
  liquidity: "流动性",
  sentiment: "情绪",
  events: "重要事件",
};
export const STATES: Record<State, string> = {
  BROAD_ACTIVE: "广泛活跃",
  STRUCTURE_LED: "结构主导",
  BALANCED: "均衡震荡",
  RISK_CONTRACTION: "风险收缩",
  INSUFFICIENT_EVIDENCE: "证据不足",
};
export const SCENARIOS: Record<Scenario, string> = {
  normal: "正常演示",
  missing_breadth: "市场宽度缺失",
  api_failure: "接口失败",
  stale_data: "数据过期",
  data_conflict: "数据冲突",
};
