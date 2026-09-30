import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
});
await page.goto("http://127.0.0.1:3000/");
await page.screenshot({ path: "/private/tmp/yanshi-home.png", fullPage: true });
await page.getByRole("button", { name: "开始研判", exact: true }).click();
await page.getByRole("heading", { name: "结构主导", exact: true }).waitFor();
await page.screenshot({
  path: "/private/tmp/yanshi-report.png",
  fullPage: true,
});
await page
  .getByRole("button", { name: "查看来源", exact: true })
  .first()
  .click();
await page.screenshot({ path: "/private/tmp/yanshi-source.png" });
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "/private/tmp/yanshi-mobile.png",
  fullPage: true,
});
await browser.close();
