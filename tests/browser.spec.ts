import { test, expect } from "@playwright/test";
test("research, source trace, continuation and compliance", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /看清市场/ })).toBeVisible();
  await page.getByRole("button", { name: "开始研判", exact: true }).click();
  await expect(page.getByText("正在研判市场", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "结构主导", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText(/DEMO DATA/).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "查看来源", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("统计口径", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "市场风格", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "结构主导", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText("当前成长还是价值风格更强？", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "新建研究", exact: true }).click();
  await page.getByLabel("你想研究当前市场的什么？").fill("明天会上涨吗？");
  await page.getByRole("button", { name: "开始研判", exact: true }).click();
  await expect(page.getByText(/研势不提供确定性涨跌预测/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "研判当前市场", exact: true }),
  ).toBeVisible();
});
test("all degradation scenarios remain inspectable and retryable", async ({
  page,
}) => {
  for (const scenario of [
    "missing_breadth",
    "api_failure",
    "stale_data",
    "data_conflict",
  ]) {
    await page.goto("/");
    await page.getByLabel("演示场景").selectOption(scenario);
    await page.getByRole("button", { name: "开始研判", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "证据不足", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: "重新获取数据", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByText("当前证据不足，暂不形成市场状态判断。", { exact: true })
        .first(),
    ).toBeVisible();
  }
});
test("mobile layout does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "开始研判", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "结构主导", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
