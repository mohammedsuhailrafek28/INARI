const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("fs");
const BASE = process.env.INARI_BASE_URL || "http://127.0.0.1:4320";
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  async function run(name, fn) {
    try {
      await fn();
      results.push({ name, status: "PASS" });
      console.log("PASS", name);
    } catch (e) {
      results.push({ name, status: "FAIL", error: e.message });
      console.log("FAIL", name, e.message);
    }
  }
  let c = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  let p = await c.newPage();
  p.setDefaultTimeout(12000);
  await run(
    "Original fictional-persona onboarding and profile switching remain interactive",
    async () => {
      await p.goto(BASE + "/choose-profile");
      await p
        .getByRole("button", { name: "Continue", exact: true })
        .first()
        .click();
      await p.waitForURL("**/dashboard");
      await p
        .getByRole("heading", { name: "Your financial picture." })
        .waitFor();
      await p.waitForLoadState("networkidle");
      const old = await p.locator("main").innerText();
      await p.getByLabel("Switch active profile").selectOption({ index: 1 });
      await p
        .getByRole("heading", { name: "Your financial picture." })
        .waitFor();
      await p.getByTestId("mode-banner").waitFor();
      await p.waitForLoadState("networkidle");
      const changed = await p.locator("main").innerText();
      assert.notEqual(old, changed);
      assert.match(changed, /Sample persona \(fictional\)/);
      assert.equal(await p.getByTestId("ledger-pulse").count(), 0);
      await p.screenshot({
        path: "docs/final-design/screenshots/persona-dashboard.png",
        fullPage: true,
      });
    }
  );
  await c.close();
  c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  p = await c.newPage();
  p.setDefaultTimeout(12000);
  await run(
    "Mobile CSV preview and confirm are usable with explicit confirmation",
    async () => {
      await p.goto(BASE + "/import");
      await p
        .getByRole("button", {
          name: "Load synthetic CSV (494 rows)",
          exact: true,
        })
        .click();
      await p
        .getByRole("button", {
          name: "Confirm import of 494 transactions",
          exact: true,
        })
        .click();
      await p.getByTestId("import-done").waitFor();
      assert.match(await p.getByTestId("ledger-summary").innerText(), /494/);
    }
  );
  await run(
    "Mobile what-if uses actual backend results and refreshed parameter state",
    async () => {
      await p.goto(BASE + "/recommendations#whatif");
      await p
        .locator("#whatif")
        .getByLabel("Scenario", { exact: true })
        .selectOption("income");
      await p.getByLabel("Scenario amount in rupees").fill("-10000");
      await p
        .getByRole("button", { name: "Run scenario", exact: true })
        .click();
      await p.getByTestId("whatif-result").waitFor();
      assert.match(
        await p.getByTestId("whatif-result").innerText(),
        /₹17,625.96/
      );
      await p.locator("#whatif").scrollIntoViewIfNeeded();
      await p.screenshot({
        path: "docs/final-design/screenshots/mobile-scenario-interaction.png",
      });
    }
  );
  await run(
    "Mobile advisor textarea accepts dictated-style text and submits a grounded answer",
    async () => {
      await p.goto(BASE + "/avatar");
      await p.getByLabel("Ask a question", { exact: true }).focus();
      await p.keyboard.insertText("How much did I spend on dining last month?");
      assert.equal(
        await p.getByLabel("Ask a question", { exact: true }).inputValue(),
        "How much did I spend on dining last month?"
      );
      const res = p.waitForResponse(
        r => r.url().includes("inari.ask") && r.request().method() === "POST"
      );
      await p.getByRole("button", { name: "Send question to advisor" }).click();
      await res;
      await p.getByText(/In September 2026 you spent ₹3,377/).waitFor();
      await p.screenshot({
        path: "docs/final-design/screenshots/mobile-advisor-interaction.png",
        fullPage: true,
      });
    }
  );
  await c.close();
  await browser.close();
  fs.writeFileSync(
    "docs/final-design/acceptance-secondary.json",
    JSON.stringify(
      {
        results,
        passed: results.filter(r => r.status === "PASS").length,
        failed: results.filter(r => r.status === "FAIL").length,
      },
      null,
      2
    )
  );
  process.exitCode = results.some(r => r.status === "FAIL") ? 1 : 0;
})();
