import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:3000/");
await page.waitForTimeout(1000);
console.log(
  JSON.stringify({
    page: "home",
    errors,
    webmcp: await page.evaluate(() => !!document.modelContext?.registerTool),
  }),
);
await page.getByRole("button", { name: "开始研判", exact: true }).click();
await page.getByRole("heading", { name: "结构主导", exact: true }).waitFor();
await page.waitForTimeout(200);
console.log(JSON.stringify({ page: "report", errors }));
await browser.close();
