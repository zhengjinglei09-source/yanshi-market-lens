"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Sparkles,
  Search,
  Layers3,
  ShieldCheck,
  ScanLine,
  Plus,
  BookOpen,
  ChevronRight,
  Check,
  LoaderCircle,
  TriangleAlert,
  RotateCcw,
  Clock3,
  FileText,
  SlidersHorizontal,
  Info,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";
import {
  DIMENSIONS,
  STATES,
  SCENARIOS,
  Report,
  Evidence,
  Scenario,
} from "@/lib/types";
import { parseIntent, buildPlan } from "@/lib/engine";
import { runResearch } from "@/lib/workflow";
import { getReport, saveReport } from "@/lib/report-store";
const suggestions = [
  "最近是普涨还是结构性行情？",
  "当前成长还是价值风格更强？",
  "当前最值得关注的风险变量是什么？",
];
const steps = [
  "理解研究问题",
  "制定取数计划",
  "获取市场数据",
  "校验证据",
  "形成市场状态判断",
];
const statusLabels = {
  valid: "有效",
  missing: "Unavailable",
  stale: "已过期",
  conflict: "存在冲突",
};
const mode = process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "mock";
function time(s: string) {
  return s
    ? new Date(s)
        .toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
        .replaceAll("/", ".") + " CST"
    : "暂无数据";
}
export default function ResearchApp({
  reportPage = false,
}: {
  reportPage?: boolean;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("当前 A 股处于什么状态？");
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [report, setReport] = useState<Report | null>(null),
    [busy, setBusy] = useState(false),
    [step, setStep] = useState(0),
    [attempt, setAttempt] = useState(1),
    [progressEvidence, setProgressEvidence] = useState<Evidence[]>([]),
    [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Evidence | null>(null),
    [method, setMethod] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  const execute = useCallback(
    async (q: string, s: Scenario) => {
      if (lock.current) return;
      const intent = parseIntent(q);
      setQuestion(q);
      setMessage("");
      if (!intent.allowed) {
        setMessage(intent.message);
        return;
      }
      lock.current = true;
      setBusy(true);
      setReport(null);
      setStep(0);
      setProgressEvidence([]);
      setAttempt(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      try {
        const result = await runResearch(
          q.trim(),
          s,
          mode,
          (n, e) => {
            setStep(n);
            if (e) setProgressEvidence(e);
          },
          setAttempt,
        );
        saveReport(result);
        setReport(result);
        if (!reportPage) router.push("/report/");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "研究未完成，请重试。");
      } finally {
        setBusy(false);
        lock.current = false;
      }
    },
    [reportPage, router],
  );
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (!reportPage) return;
    const cached = getReport();
    if (cached) {
      setReport(cached);
      setQuestion(cached.question);
      setScenario(cached.scenario);
      return;
    }
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("yanshi-request") ?? "null",
      );
      if (
        saved &&
        typeof saved.question === "string" &&
        typeof saved.scenario === "string" &&
        Object.hasOwn(SCENARIOS, saved.scenario)
      ) {
        setScenario(saved.scenario);
        void execute(saved.question, saved.scenario);
      }
    } catch {
      /* A clean report route offers a new research entry. */
    }
  }, [reportPage, execute]);
  useEffect(() => {
    type Context = {
      registerTool: (
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => unknown;
        },
        options: { signal: AbortSignal },
      ) => unknown;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "read_market_assessment",
            title: "读取当前市场研判",
            description:
              "读取当前已完成报告，包含数据模式、状态与证据；不会发起研究。",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input) {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object");
              if (!report || busy) return { status: "no_completed_report" };
              return {
                mode: report.mode,
                state: report.assessment.state,
                question: report.question,
                confidence: report.assessment.confidence,
                evidence: report.evidence.map((e) => ({
                  id: e.id,
                  title: e.title,
                  value: e.value,
                  status: e.status,
                  source: e.source,
                  timestamp: e.timestamp,
                })),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional browser capability. */
    }
    return () => lifecycle.abort();
  }, [report, busy]);
  const plan = buildPlan(question);
  const result = report?.assessment;
  function refs(ids: string[]) {
    return (
      <span className="refs">
        {ids.map((id) => (
          <button
            key={id}
            aria-label={`查看证据 ${id}`}
            onClick={() =>
              setSelected(report?.evidence.find((e) => e.id === id) ?? null)
            }
          >
            {id}
          </button>
        ))}
      </span>
    );
  }
  return (
    <>
      <header className="header">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Activity size={23} />
          </span>
          研势<span className="brand-sub">A 股市场状态研判助手</span>
        </a>
        <div className="header-end">
          <Button variant="ghost" size="sm" onClick={() => setMethod(true)}>
            <BookOpen size={15} />
            <span className="method-label">研判方法</span>
          </Button>
          <span className={mode === "mock" ? "demo-tag" : "live-tag"}>
            {mode === "mock" ? "DEMO DATA" : "LIVE + DEMO DATA"}
          </span>
        </div>
      </header>
      {busy ? (
        <main className="loading-page">
          <div className="loading-symbol">
            <ScanLine size={31} />
          </div>
          <div className="eyebrow centered">RESEARCH IN PROGRESS</div>
          <h1>正在研判市场</h1>
          <p className="muted">{question}</p>
          <div className="loading-panel">
            <div className="steps">
              {steps.map((s, i) => (
                <div
                  className={`step ${i < step ? "done" : i === step ? "active" : ""}`}
                  key={s}
                >
                  <span>
                    {i < step ? (
                      <Check size={15} />
                    ) : i === step ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {s}
                  {i === 2 && attempt > 1 && <small>第 {attempt} 次尝试</small>}
                </div>
              ))}
            </div>
            <div className="plan">
              <div className="mini-heading">
                本次取数计划 <span>{plan.focus}</span>
              </div>
              <p>{plan.explanation}</p>
              <div className="dimension-list">
                {plan.dimensions.map((d) => {
                  const e = progressEvidence.find((e) => e.dimension === d);
                  return (
                    <div key={d}>
                      <span>{DIMENSIONS[d]}</span>
                      {e ? (
                        <span
                          className={
                            e.status === "valid" ? "good-text" : "warning-text"
                          }
                        >
                          {e.status === "valid" ? (
                            <>
                              <Check size={13} /> 已获取
                            </>
                          ) : (
                            <>
                              <TriangleAlert size={13} />{" "}
                              {statusLabels[e.status]}
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="muted">
                          {step >= 2 ? "获取中" : "待获取"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="loading-note">
            {mode === "mock"
              ? "正在运行模拟数据流程 · 解释由确定性模板生成"
                : "正在获取扶摇指数行情；其余维度使用 Demo Data"}
          </p>
        </main>
      ) : report && result ? (
        <main className="report">
          <div className="report-topline">
            <div>
              <span>研究工作台</span>
              <ChevronRight size={14} />
              <span>市场研判报告</span>
            </div>
            <a href="/" className="text-link">
              新建研究
            </a>
          </div>
          <div className="report-heading">
            <div>
              <div className="eyebrow">MARKET ASSESSMENT</div>
              <h1>市场有结构，判断有依据。</h1>
              <p className="report-question">
                <Search size={15} />
                {report.question}
              </p>
            </div>
            <span className="report-date">
              <Clock3 size={14} />
              本次研究 ·{" "}
              {new Date(report.createdAt).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <details className="report-plan">
            <summary>
              <ScanLine size={14} />
              研究重点：{report.plan.focus}
              <span>查看取数计划</span>
            </summary>
            <p>{report.plan.explanation}</p>
            <div>
              {report.plan.dimensions.map((d) => (
                <span key={d}>{DIMENSIONS[d]}</span>
              ))}
            </div>
          </details>
          <div className="demo-notice">
            <Info size={16} />
            <span>
              {mode === "mock"
                ? "全部数值均为合成演示数据，非当前市场行情。归纳为规则模板演示，尚未连接大模型。"
                : report.evidence.some((e) => e.fallback)
                  ? "真实数据暂不可用，当前使用 Demo Data。所有维度均为合成演示数据。"
                  : "行情结构使用扶摇真实指数快照；其他维度为 DEMO DATA。判断是混合证据的规则归纳，尚未连接大模型。"}
            </span>
          </div>
          <div className="summary-grid">
            <section
              className={`state-card ${result.state === "INSUFFICIENT_EVIDENCE" ? "insufficient" : ""}`}
            >
              <div className="card-label">
                <span>SYNTHESIS</span>
                <span>01 / 当前市场状态</span>
              </div>
              <div className="state-line">
                <h2>{STATES[result.state]}</h2>
                <span className="state-symbol">
                  <Layers3 size={28} />
                </span>
              </div>
              <p className="state-summary">{result.summary}</p>
              <div className="tag-row">
                {result.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="state-card-bottom">
                {refs(result.evidenceIds)}
                <span>规则引擎 v1.0</span>
              </div>
            </section>
            <section className="confidence-card">
              <div className="mini-heading">
                证据一致度 <Info size={15} />
              </div>
              <div className="confidence-number">
                {result.state === "INSUFFICIENT_EVIDENCE"
                  ? "—"
                  : result.confidence}
                <span>
                  {result.state === "INSUFFICIENT_EVIDENCE" ? "不计算" : "%"}
                </span>
              </div>
              <div className="confidence-bar">
                <span style={{ width: result.confidence + "%" }} />
              </div>
              <p>
                置信度表示当前证据对状态判断的一致程度，不代表未来涨跌概率。
              </p>
              <button className="text-link" onClick={() => setMethod(true)}>
                查看判断规则
                <ChevronRight size={13} />
              </button>
            </section>
          </div>
          <div className="cutoff">
            <span>
              <Clock3 size={14} />
              {report.evidence.some((e) => e.dimension === "market_structure" && e.source.startsWith("同花顺扶摇"))
                ? "行情结构数据时间："
                : "演示数据时间："}{time(report.dataCutoff)}
            </span>
            <span>
              有效证据{" "}
              {report.evidence.filter((e) => e.status === "valid").length} / 7 ·{" "}
              {SCENARIOS[report.scenario]}
            </span>
          </div>
          <section className="contradiction">
            <div className="section-number">02</div>
            <div>
              <div className="section-title-row">
                <h2>当前主要矛盾</h2>
                <span className="type-label synthesis">SYNTHESIS</span>
              </div>
              <h3>{result.majorContradiction.title}</h3>
              <p>{result.majorContradiction.explanation}</p>
              {refs(result.majorContradiction.evidenceIds)}
            </div>
          </section>
          <section className="evidence-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">THE EVIDENCE</div>
                <h2>为什么得到这个判断？</h2>
              </div>
              <span className="muted">事实与归纳，分开呈现</span>
            </div>
            <div className="evidence-grid">
              {report.evidence.map((e) => (
                <article
                  className={`evidence-card ${e.status !== "valid" ? "evidence-invalid" : ""}`}
                  key={e.id}
                >
                  <div className="evidence-top">
                    <span>
                      {e.id} <i /> {DIMENSIONS[e.dimension]}
                    </span>
                    <span className={`status ${e.status}`}>
                      {e.status === "valid" && <span />}
                      {statusLabels[e.status]}
                    </span>
                  </div>
                  <h3>{e.title}</h3>
                  <button
                    className="evidence-value"
                    onClick={() => setSelected(e)}
                    aria-label={`${e.title} ${e.value ?? "暂无数据"}，查看来源`}
                  >
                    {e.value ?? "—"}
                    <small>{e.unit}</small>
                  </button>
                  <div className="evidence-fact">
                    <span className="type-label">
                      FACT {e.source.startsWith("DEMO") && "· DEMO"}
                    </span>
                    <p>{e.fact}</p>
                  </div>
                  <div className="evidence-synthesis">
                    <span className="type-label synthesis">SYNTHESIS</span>
                    <p>
                      {e.status === "valid"
                        ? e.synthesis
                        : (e.issue ?? "数据暂不可用，本次判断未使用该维度。")}
                    </p>
                  </div>
                  <div className="evidence-meta">
                    <span>{time(e.timestamp)}</span>
                    <span>{e.source}</span>
                  </div>
                  <button
                    className="source-button"
                    onClick={() => setSelected(e)}
                  >
                    <FileText size={14} />
                    查看来源
                    <ChevronRight size={14} />
                  </button>
                </article>
              ))}
            </div>
          </section>
          <section className="conditions-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">WATCH FOR CHANGE</div>
                <h2>什么会改变当前判断？</h2>
              </div>
              <span className="type-label uncertainty">UNCERTAINTY</span>
            </div>
            <p className="section-description">
              跟踪形成判断的关键证据，识别需要重新评估的条件。
            </p>
            {result.switchConditions.length ? (
              <div className="conditions">
                {result.switchConditions.map((c, i) => (
                  <article key={c.condition}>
                    <span className="condition-number">0{i + 1}</span>
                    <div>
                      <h3>{c.condition}</h3>
                      <p>{c.implication}</p>
                      {refs(c.evidenceIds)}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-conditions">
                <TriangleAlert size={20} />
                <div>
                  <h3>先恢复证据，再讨论状态变化</h3>
                  <p>
                    当前证据不足，暂不生成状态切换条件。请核验缺失、过期或冲突的数据。
                  </p>
                </div>
              </div>
            )}
          </section>
          <section className="caveats">
            <div>
              <TriangleAlert size={17} />
              <h3>本次研究的边界</h3>
            </div>
            <ul>
              {result.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
              {report.plan.focus === "行业结构" && (
                <li>{report.plan.explanation}</li>
              )}
              <li>阈值为 MVP 产品规则，未经历史统计校准，不是行业标准。</li>
              <li>
                演示维度使用固定校验时钟：2026.09.28 15:15 CST；它们不代表当前行情。
              </li>
              {mode === "live" && (
                <li>仅行情结构尝试获取真实指数快照；混合证据的判断不能视为真实市场整体状态。</li>
              )}
            </ul>
            {result.state === "INSUFFICIENT_EVIDENCE" && (
              <Button
                variant="outline"
                onClick={() => execute(report.question, scenario)}
              >
                <RotateCcw size={15} />
                重新获取数据
              </Button>
            )}
          </section>
          <section className="continue">
            <div>
              <Sparkles size={22} />
              <h2>继续研究</h2>
              <p>沿着证据，进一步理解市场。</p>
            </div>
            <div>
              {[
                ["市场风格", "当前成长还是价值风格更强？"],
                ["行业结构", "当前 A 股行业结构有哪些分化？"],
                ["风险变量", "当前最值得关注的风险变量是什么？"],
              ].map(([label, q]) => (
                <Button
                  variant="outline"
                  key={label}
                  onClick={() => execute(q, scenario)}
                >
                  {label}
                  <Plus size={14} />
                </Button>
              ))}
            </div>
          </section>
          <div className="report-controls">
            <label>
              <SlidersHorizontal size={14} />
              演示场景
              <select
                aria-label="演示场景"
                value={scenario}
                onChange={(e) => setScenario(e.target.value as Scenario)}
              >
                {Object.entries(SCENARIOS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              onClick={() => execute(report.question, scenario)}
            >
              <RotateCcw size={14} />
              重新研判
            </Button>
          </div>
        </main>
      ) : (
        <main className="home">
          <div className="eyebrow">
            <span />
            用证据理解市场
          </div>
          <h1>
            看清市场
            <br />
            正在发生什么<span className="period">。</span>
          </h1>
          <p className="hero-description">
            基于市场数据与重要事件理解当前状态，而不是预测未来。
          </p>
          <form
            className="research-form"
            onSubmit={(e) => {
              e.preventDefault();
              void execute(question, scenario);
            }}
          >
            <label htmlFor="question">
              <Sparkles size={18} />
              你想研究当前市场的什么？
            </label>
            <textarea
              id="question"
              placeholder="当前 A 股处于什么状态？"
              maxLength={300}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setMessage("");
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void execute(question, scenario);
                }
              }}
            />
            <div className="input-footer">
              <span>从一个好问题，开始理解市场</span>
              <Button type="submit" disabled={!question.trim()}>
                <Search size={17} />
                开始研判
              </Button>
            </div>
          </form>
          {message && (
            <div className="compliance-message" role="alert">
              <ShieldCheck size={22} />
              <div>
                <p>{message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => execute("当前 A 股处于什么状态？", scenario)}
                >
                  研判当前市场
                </Button>
              </div>
              <button
                className="icon-btn"
                aria-label="关闭提示"
                onClick={() => setMessage("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="quick-questions">
            <span>试着问</span>
            {suggestions.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuestion(q);
                  setMessage("");
                  document.getElementById("question")?.focus();
                }}
              >
                {q}
                <Plus size={14} />
              </button>
            ))}
          </div>
          <div className="home-bottom">
            <div className="section-kicker">让每一次判断，都有据可循</div>
            <div className="feature-grid">
              {[
                [
                  ScanLine,
                  "识别市场状态",
                  "从七个维度观察市场，理解当下的结构。",
                ],
                [
                  Layers3,
                  "找到主要矛盾",
                  "把分散信号串起来，找到最值得关注的分歧。",
                ],
                [
                  ShieldCheck,
                  "关注变化条件",
                  "明确哪些证据变化后，需要重新评估判断。",
                ],
              ].map(([Icon, title, body]) => (
                <div className="feature" key={String(title)}>
                  {typeof Icon !== "string" && <Icon size={22} />}
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="home-demo-controls">
            <span>
              <Info size={14} />
              {mode === "mock"
                ? "模拟数据体验 · 规则归纳演示"
                : "指数行情接入扶摇；其余维度为 Demo Data"}
            </span>
            <label>
              演示场景
              <select
                aria-label="演示场景"
                value={scenario}
                onChange={(e) => setScenario(e.target.value as Scenario)}
              >
                {Object.entries(SCENARIOS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </main>
      )}
      <footer>
        研势 YANSHI <span>每个判断，都回到证据。</span>
        <span>不提供涨跌预测或投资建议</span>
      </footer>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.title ?? "证据来源"}
        description="从判断回到原始证据，核对数据来源与时间。"
      >
        {selected && (
          <>
            <div className="source-value">
              <span className="type-label">
                FACT {selected.source.startsWith("DEMO") && "· DEMO"}
              </span>
              <strong>
                {selected.value ?? "暂无数据"}
                <small>{selected.unit}</small>
              </strong>
              <span className={`status ${selected.status}`}>
                {statusLabels[selected.status]}
              </span>
            </div>
            <dl className="source-details">
              {[
                ["证据编号", selected.id],
                ["指标", selected.title],
                ["数据来源", selected.source],
                ["数据时间", time(selected.timestamp)],
                ["单位", selected.unit ?? "不适用"],
                ["统计区间", selected.period ?? "未提供"],
                ["统计口径", selected.methodology ?? "未提供"],
                ["数据状态", selected.issue ?? statusLabels[selected.status]],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {selected.raw && (
              <div className="raw-fields">
                <h3>原始字段 · {selected.source.startsWith("DEMO") ? "合成 fixture" : "扶摇快照"}</h3>
                <pre>{JSON.stringify(selected.raw, null, 2)}</pre>
              </div>
            )}
            <div className="source-disclaimer">
              <Info size={16} />
              <p>
                {selected.source.startsWith("DEMO")
                  ? "来源是本项目的版本化演示数据集，不存在对应的外部行情链接。"
                  : "来源是扶摇 A 股指数行情快照；时间采用接口返回的 data.timestamp。"}
              </p>
            </div>
          </>
        )}
      </Sheet>
      <Sheet
        open={method}
        onOpenChange={setMethod}
        title="判断如何形成"
        description="先校验证据，再由规则生成候选状态。解释不能擅自改变状态。"
      >
        <div className="method-content">
          <h3>四个核心信号</h3>
          <p>
            行情结构、市场宽度、流动性、情绪。风格解释结构，估值与事件提供背景。
          </p>
          <h3>透明的 MVP 阈值</h3>
          <p>上涨股票占比：≥60% 强；40%–60%（不含 60%）中性；低于 40% 弱。</p>
          <p>成交额 / 20 日均额：≥1.15 活跃；≤0.85 收缩；其余中性。</p>
          <h3>候选评分</h3>
          <table>
            <tbody>
              {[
                [
                  "广泛活跃",
                  "宽度强 +3；流动性活跃 +2；结构一致 +2；情绪活跃 +1",
                ],
                ["结构主导", "宽度弱或中性 +2；指数分化 +2；风格领先 +3"],
                [
                  "均衡震荡",
                  "宽度中性 +2；结构中性 +2；流动性中性 +1；无风格优势 +2",
                ],
                [
                  "风险收缩",
                  "宽度弱 +3；结构偏弱 +2；流动性收缩 +2；情绪偏弱 +2",
                ],
              ].map(([s, r]) => (
                <tr key={s}>
                  <th>{s}</th>
                  <td>{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            四项核心证据必须有效；最高分不足 4 分，或领先不足 2
            分，返回证据不足。缺失、过期、冲突数据不参加评分。
          </p>
          {result && (
            <>
              <h3>本次评分</h3>
              <div className="score-list">
                {Object.entries(result.scores).map(([s, v]) => (
                  <div key={s}>
                    <span>{STATES[s as keyof typeof STATES]}</span>
                    <strong>{v} 分</strong>
                  </div>
                ))}
              </div>
              <h3>本次置信度</h3>
              <ul>
                {result.confidenceFactors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}
          <h3>AI 的边界</h3>
          <p>
            当前版本使用关键词意图解析与确定性归纳模板，尚未连接大模型。不会生成行情数字；不作涨跌、收益、选股、买卖或仓位建议。
          </p>
          <p>
            规则是可解释的产品启发式，未经过历史校准。置信度不是未来涨跌概率。
          </p>
        </div>
      </Sheet>
    </>
  );
}
