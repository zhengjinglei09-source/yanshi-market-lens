# 研势｜AI 驱动的 A 股市场大势研判

研势面向希望快速理解 A 股市场结构的个人投资研究用户，回答三个问题：当前市场处于什么状态、主要矛盾是什么、哪些条件出现后需要重新评估判断。产品不提供涨跌预测、选股、买卖、仓位或收益建议。

在线 Demo：<https://yanshi-market-lens.pages.dev/report/>（现有部署地址；本次仓库整理不重新部署网站）。

**实际实现：开发中使用 ChatGPT / Codex；运行时使用关键词解析、确定性评分与解释模板，尚未调用大模型。仅指数行情实现扶摇接口接入，其余维度为模拟数据或不可用。接口接入代码不等于线上授权已验证。**

## 产品与核心设计

首页 `/` 输入研究问题，报告页 `/report/` 承载研究过程、市场状态、主要矛盾、证据、数据时点、证据一致度和判断改变条件。

```text
问题 → 范围及合规检查 → 意图与七维取数计划 → 获取数据（最多两次尝试）
     → 字段、时间与冲突校验 → Evidence → 候选状态评分 → 报告与继续研究
```

七个维度：行情结构、市场宽度、风格轮动、估值、流动性、情绪、重要事件。四项核心证据为行情结构、市场宽度、流动性、情绪；任一不可用、最高候选分不足 4 分或领先不足 2 分，输出“证据不足”。有效状态包括广泛活跃、结构主导、均衡震荡、风险收缩。

- `FACT`：接口事实或明确标记的模拟事实；`SYNTHESIS`：规则归纳；`UNCERTAINTY`：条件性判断。
- 结论通过 `evidenceIds` 关联证据；来源抽屉展示来源、时点、单位、区间、统计口径和原始字段。
- 置信度表示启发式的证据一致度，不是上涨概率；规则未经统计回测。
- 继续研究调整问题、研究重点和证据顺序；行业数据未接入时不生成行业排名。
- 会话仅保存研究问题与演示场景，刷新后重新执行研究；不保存用户资产或密钥。

## AI 角色

ChatGPT 协助需求梳理、产品边界及交付结构；Codex 协助实现、测试和文档核对。目标设计中的 AI 负责问题理解、研究计划与证据解释，但当前版本以规则与模板实现，不能宣称已完成真实模型推理或自主工具代理。详见 [AI 使用与验证记录](AI_USAGE_VALIDATION.md)。

## 数据来源与降级

`lib/fuyao-index.ts` 实现扶摇三指数快照请求：上证指数 `000001.SH`、沪深300 `000300.SH`、创业板指 `399006.SZ`。接口路径为 `/api/a-share-index/prices/snapshot`，使用 `thscodes` 参数和服务端 `X-api-key` 请求头；字段为 `last_price`、`price_change_ratio_pct`、`data.timestamp`。接口参考地址保留在源码中。

三指数必须完整且不重复、价格为正有限数、涨跌幅为有限数、时间有效且不超过 36 小时。合格结果仅替换 E01 行情结构。其他数值维度来自 `lib/fixtures.ts` 的合成样本；事件维度明确不可用。未接入 iFinD。

- `live`（默认）：正常场景尝试真实 E01；缺少密钥、接口失败或数据不合格时，最多尝试两次后仅 E01 回退 Demo，页面明确显示“真实数据暂不可用，当前使用 Demo Data”。这仍可能生成演示报告，不能当作真实市场结论。
- `mock`：全模拟演示。五种场景为正常、宽度缺失、接口失败、过期、冲突；后四种输出证据不足。
- 模拟数据基准为 2026-09-28 15:00，校验时钟固定为当日 15:15（Asia/Shanghai）。真实数据采用当前时间校验，两者时点逐项披露。
- 周末或长假快照可能超过 36 小时而回退；尚未接交易日历。

仓库仅包含应用代码与合成 fixture，不包含真实接口响应归档、受限行情数据、密钥或环境文件。

## 本地运行

本次验证环境为 Node.js 22.22.1、npm 10.9.4；建议使用 Node.js 22.12+。

```sh
npm ci
DATA_MODE=mock npm run dev
```

打开 <http://localhost:5173/>。依赖锁文件随源码提交。技术栈为 Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / Radix UI；原项目开发与 Worker 构建使用 vinext / Vite。

### 环境变量

| 名称 | 用途与默认值 | 配置位置 |
| --- | --- | --- |
| `DATA_MODE` | `live`（默认）或 `mock`，构建时确定浏览器数据模式 | 本地进程或托管构建环境 |
| `HITHINK_FINANCE_API_KEY` | 扶摇凭证；未设置时明确回退模拟数据 | 服务端密钥环境变量，禁止 `NEXT_PUBLIC_*` |
| `NEXT_PUBLIC_DATA_MODE` | 由 `next.config.ts` 根据 `DATA_MODE` 生成，仅公开模式 | 不单独维护 |
| `NEXT_OUTPUT_EXPORT` | Pages 构建脚本内部设为 `1` | 不需手工设置 |
| `TEST_BASE_URL` | 浏览器测试地址，默认 `http://127.0.0.1:5173` | 测试进程 |

纯演示无需任何密钥。真实模式在服务端配置 `HITHINK_FINANCE_API_KEY` 后启动。不要把密钥粘贴进源码、文档、命令历史或浏览器；`.env*`、`.dev.vars*`、本地密钥与运行目录均被忽略。

### 构建与现有部署方式

```sh
# Cloudflare Pages：Next 静态前端 + Pages Functions
DATA_MODE=live npm run build:pages
# 仅在自行配置 Cloudflare 登录、项目和服务端密钥后发布
npm run deploy:pages -- --project-name=yanshi-market-lens
```

`build:pages` 输出 `out/`；服务端接口由 `functions/api/index-structure.ts` 提供。仅上传静态目录到普通静态服务器不会提供真实行情 API。密钥配置在 Cloudflare Pages 的服务端 Secrets 中，预览与生产环境分别管理。

`npm run build` 保留原 vinext / Worker 构建方式，`npm start` 运行生成的本地 Worker。原站点绑定信息 `.openai/hosting.json` 不进入交付仓库；本次不改动原托管关系。

## 源码导航

| 路径 | 职责 |
| --- | --- |
| `app/`、`components/` | 两页面、报告交互、来源抽屉 |
| `lib/engine.ts` | 意图、合规、数据校验、评分和判断改变条件 |
| `lib/workflow.ts` | 取数、重试、降级和报告组织 |
| `lib/fuyao-index.ts` | 三指数快照解析与 Evidence 转换 |
| `lib/fixtures.ts`、`lib/types.ts` | 合成数据和结构定义 |
| `app/api/index-structure/route.ts` | 原应用服务端代理 |
| `functions/api/index-structure.ts` | Cloudflare Pages 服务端代理 |
| `tests/` | 规则、数据适配与浏览器测试 |

## 验证与边界

运行步骤、覆盖范围和本次实际结果见 [测试说明](TESTING.md)；产品规则见 [实现决策](docs/DECISIONS.md)；演示步骤见 [演示脚本](docs/DEMO.md)。旧截图辅助脚本使用 3000 端口，本次按实际 5173 端口运行正式浏览器测试。

未做事项：真实大模型、iFinD、其余维度真实数据、行业与事件分析、交易日历、自动刷新、长期监控调度、去重冷却、任务恢复与版本管理、登录、自选股和交易功能、统计回测、负载压测与完整无障碍审计。关键词合规检查可能误拦截或漏检；固定模板不能替代生产级审核。WebMCP 只读报告工具需浏览器提供 `document.modelContext`，普通页面不依赖它。

此仓库从现有研势工作目录整理，保留未提交的 Pages 代码；未重建产品。首次提交不迁移原仓库历史，避免连带上传历史环境配置或运行数据。部署可达性与真实授权响应需单独验收。
