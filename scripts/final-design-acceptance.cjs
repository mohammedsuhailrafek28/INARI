/** Real browser acceptance against the production server. All fixtures are synthetic.
 * npm install --no-save playwright in a separate tool folder, then set PLAYWRIGHT_MODULE
 * to its module path. Run: node scripts/final-design-acceptance.cjs
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const BASE = process.env.INARI_BASE_URL || "http://127.0.0.1:4320";
const OUT = path.resolve("docs/final-design");
const SHOTS = path.join(OUT, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
let browser, page, context;
const pageErrors = [];
async function step(name, fn) {
  if (
    process.env.INARI_ACCEPTANCE_FILTER &&
    !name
      .toLowerCase()
      .includes(process.env.INARI_ACCEPTANCE_FILTER.toLowerCase())
  )
    return;
  const start = Date.now();
  try {
    const details = await fn();
    results.push({
      name,
      status: "PASS",
      details: details ?? null,
      ms: Date.now() - start,
    });
    console.log("PASS", name);
  } catch (e) {
    results.push({
      name,
      status: "FAIL",
      error: e.message,
      ms: Date.now() - start,
    });
    console.log("FAIL", name, e.message);
    if (page)
      await page
        .screenshot({
          path: path.join(SHOTS, "failure-" + results.length + ".png"),
          fullPage: true,
        })
        .catch(() => {});
  }
}
async function clickMutation(p, locator, procedure) {
  const response = p.waitForResponse(
    r => r.url().includes(procedure) && r.request().method() === "POST"
  );
  await locator.click();
  const r = await response;
  const body = await r.json();
  const list = Array.isArray(body) ? body : [body];
  for (const result of list)
    if (result.error) throw Error(JSON.stringify(result.error));
}
async function rpc(ctx, proc, input, mutation = false) {
  const encoded = { json: input ?? null };
  const r = mutation
    ? await ctx.request.post(BASE + "/api/trpc/" + proc, { data: encoded })
    : await ctx.request.get(
        BASE +
          "/api/trpc/" +
          proc +
          (input === undefined
            ? ""
            : "?input=" + encodeURIComponent(JSON.stringify(encoded)))
      );
  const body = await r.json();
  if (body.error) throw Error(JSON.stringify(body.error));
  return body.result.data.json;
}
async function visit(p, route) {
  await p.goto(BASE + route);
  await p.waitForLoadState("networkidle");
  await p.evaluate(() => document.fonts.ready);
}
async function upload(p, name, content) {
  await p.getByLabel("Choose statement file (CSV or PDF)").setInputFiles({
    name,
    mimeType: name.endsWith(".pdf") ? "application/pdf" : "text/plain",
    buffer: Buffer.from(content),
  });
  await p.getByTestId("import-preview").waitFor();
}
async function commit(p, n) {
  await p
    .getByRole("button", {
      name: `Confirm import of ${n} transaction${n === 1 ? "" : "s"}`,
      exact: true,
    })
    .click();
  await p.getByTestId("import-done").waitFor();
  assert.match(
    await p.getByTestId("import-done").innerText(),
    new RegExp(`Imported ${n} transaction`)
  );
}
async function imported(ctx, p, csv) {
  await visit(p, "/import");
  await upload(p, "synthetic-acceptance.csv", csv);
  let count = (
    await p.getByRole("button", { name: /Confirm import of/ }).innerText()
  ).match(/of (\d+)/)[1];
  await commit(p, Number(count));
}
async function isolated(fn) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(12000);
  try {
    return await fn(ctx, p);
  } finally {
    await ctx.close();
  }
}
async function screenshot(p, name) {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true });
}
async function ask(p, q) {
  const response = p.waitForResponse(
    r => r.url().includes("inari.ask") && r.request().method() === "POST"
  );
  await p.getByLabel("Ask a question", { exact: true }).fill(q);
  await p.getByRole("button", { name: "Send question to advisor" }).click();
  const r = await response;
  const j = await r.json();
  const d = (Array.isArray(j) ? j[0] : j).result.data.json;
  assert.equal(d.engine.llmUsed, false);
  await p.waitForLoadState("networkidle");
  return d;
}
(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", e => pageErrors.push(e.message));
  await step(
    "Landing explains product and enters the actual Import Center",
    async () => {
      await visit(page, "/");
      assert.match(await page.locator("h1").innerText(), /YOUR MONEY/);
      await page
        .getByRole("link", { name: "Import a statement", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Import Center", exact: true })
        .waitFor();
    }
  );
  await step(
    "Canonical CSV preview and explicit confirmation writes exactly 494 rows",
    async () => {
      await page
        .getByRole("button", {
          name: "Load synthetic CSV (494 rows)",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: "Confirm import of 494 transactions",
          exact: true,
        })
        .waitFor();
      await screenshot(page, "import-preview");
      await commit(page, 494);
      assert.equal(
        (await rpc(context, "inari.getSnapshot")).coverage.transactionCount,
        494
      );
      await screenshot(page, "import-confirmed");
    }
  );
  await step(
    "Dashboard verifies all four canonical financial invariants and unknown balances",
    async () => {
      await visit(page, "/dashboard");
      const s = await rpc(context, "inari.getSnapshot");
      assert.deepEqual(
        [s.monthlyIncome, s.monthlyExpenses, s.monthlySurplus, s.savingsRate],
        [85102, 57476.04, 27625.96, 32.46]
      );
      const pulse = await page.getByTestId("ledger-pulse").innerText();
      for (const t of ["₹85,102", "₹57,476.04", "₹27,625.96", "32.46%"])
        assert.ok(pulse.includes(t), t);
      assert.equal(s.balances.emergencyFund, null);
      assert.ok(
        (await page.locator("body").innerText()).includes("Not provided")
      );
      return s.coverage;
    }
  );
  await step(
    "Dashboard chart labels and category values agree with backend data",
    async () => {
      const categories = await rpc(context, "spending.getBreakdown");
      const top = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
      const text = await page.getByTestId("dashboard-categories").innerText();
      for (const [key, value] of top) {
        assert.ok(text.toLowerCase().includes(key.replace(/_/g, " ")), key);
        assert.ok(
          text.includes(
            new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
              maximumFractionDigits: 2,
            }).format(value)
          ),
          key
        );
      }
      const bars = page.locator("#trend [role=img]");
      assert.ok((await bars.count()) >= 6);
      assert.match(
        await bars.first().getAttribute("aria-label"),
        /income ₹.*expenses ₹/
      );
      return { topCategories: top, trendMonths: await bars.count() };
    }
  );
  await step(
    "Duplicate CSV re-import prevents any second posting",
    async () => {
      await visit(page, "/import");
      await page
        .getByRole("button", {
          name: "Load synthetic CSV (494 rows)",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Nothing to import", exact: true })
        .waitFor();
      assert.ok(
        await page
          .getByRole("button", { name: "Nothing to import", exact: true })
          .isDisabled()
      );
      assert.equal(
        (await rpc(context, "inari.getSnapshot")).coverage.transactionCount,
        494
      );
      await screenshot(page, "import-duplicates");
    }
  );
  await step(
    "Correction updates six merchant rows and downstream dashboard, chart and report",
    async () => {
      await visit(page, "/spending");
      await page
        .getByLabel("Search transactions", { exact: true })
        .fill("CREDIT CARD PAYMENT");
      await page.waitForLoadState("networkidle");
      await page
        .locator('#transactions select[aria-label^="Category for"]')
        .first()
        .selectOption("transfer");
      await page
        .getByTestId("review-msg")
        .filter({ hasText: "Updated 6 transaction(s)" })
        .waitFor();
      const s = await rpc(context, "inari.getSnapshot");
      assert.deepEqual(
        [s.monthlyExpenses, s.monthlySurplus, s.savingsRate],
        [52976.04, 32125.96, 37.75]
      );
      assert.equal(
        (await rpc(context, "inari.monthlyReport", { month: "2026-09" })).totals
          .expenses,
        45949.24
      );
      await visit(page, "/dashboard");
      assert.match(
        await page.getByTestId("ledger-pulse").innerText(),
        /₹52,976.04/
      );
      assert.equal(
        (await rpc(context, "spending.getBreakdown")).other,
        undefined
      );
      await screenshot(page, "correction-downstream");
      return {
        expenses: s.monthlyExpenses,
        surplus: s.monthlySurplus,
        savingsRate: s.savingsRate,
      };
    }
  );
  await step(
    "Correction can be restored through the same UI without losing rows",
    async () => {
      await visit(page, "/spending");
      await page
        .getByLabel("Search transactions", { exact: true })
        .fill("CREDIT CARD PAYMENT");
      await page.waitForLoadState("networkidle");
      await page
        .locator('#transactions select[aria-label^="Category for"]')
        .first()
        .selectOption("other");
      await page
        .getByTestId("review-msg")
        .filter({ hasText: "Updated 6 transaction(s)" })
        .waitFor();
      assert.equal(
        (await rpc(context, "inari.getSnapshot")).monthlySurplus,
        27625.96
      );
    }
  );
  await step(
    "Create and update a confirmed goal with a backend projection",
    async () => {
      await visit(page, "/goals");
      const goal = page.locator("#my-goals");
      await goal.getByLabel("Name", { exact: true }).fill("Japan trip");
      await goal.getByLabel("Goal target in rupees").fill("200000");
      await goal.getByLabel("Amount saved so far in rupees").fill("50000");
      await goal.getByLabel("Timeline in months").fill("24");
      await goal.getByLabel("Monthly contribution in rupees").fill("10000");
      await goal.getByRole("button", { name: "Add goal", exact: true }).click();
      await page
        .getByTestId("goal")
        .filter({ hasText: "Japan trip" })
        .waitFor();
      let g = (await rpc(context, "inari.getGoals")).items[0];
      assert.equal(g.currentAmount, 50000);
      assert.ok(g.projectedCompletion);
      await page
        .getByTestId("goal")
        .getByRole("button", { name: "Edit", exact: true })
        .click();
      await goal.getByLabel("Monthly contribution in rupees").fill("20000");
      await goal
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await page.waitForLoadState("networkidle");
      g = (await rpc(context, "inari.getGoals")).items[0];
      assert.equal(g.monthlyContribution, 20000);
      await screenshot(page, "goals-confirmed");
      return { progress: g.progressPercent, projection: g.projectedCompletion };
    }
  );
  await step(
    "Monthly report displays ledger-based September totals",
    async () => {
      await visit(page, "/recommendations");
      await page.getByLabel("Report month").selectOption("2026-09");
      await page.getByTestId("report").filter({ hasText: "₹85,306" }).waitFor();
      assert.match(await page.getByTestId("report").innerText(), /₹50,449.24/);
      await screenshot(page, "recommendations-report");
    }
  );
  await step(
    "Income-drop what-if shows expected ₹17,625.96 surplus and leaves ledger unchanged",
    async () => {
      await page
        .locator("#whatif")
        .getByLabel("Scenario", { exact: true })
        .selectOption("income");
      await page.getByLabel("Scenario amount in rupees").fill("-10000");
      await page
        .getByRole("button", { name: "Run scenario", exact: true })
        .click();
      await page.getByTestId("whatif-result").waitFor();
      assert.match(
        await page.getByTestId("whatif-result").innerText(),
        /₹17,625.96/
      );
      assert.equal(
        (await rpc(context, "inari.getSnapshot")).monthlySurplus,
        27625.96
      );
      await screenshot(page, "scenario-income-drop");
    }
  );
  await step(
    "Goal what-if displays backend completion dates and changes its dependent result",
    async () => {
      await page
        .locator("#whatif")
        .getByLabel("Scenario", { exact: true })
        .selectOption("goal");
      await page
        .locator("#whatif")
        .getByLabel("Scenario goal", { exact: true })
        .selectOption({ label: "Japan trip" });
      await page.getByLabel("Scenario amount in rupees").fill("40000");
      await page
        .getByRole("button", { name: "Run scenario", exact: true })
        .click();
      await page.getByTestId("scenario-goals").waitFor();
      const text = await page.getByTestId("scenario-goals").innerText();
      assert.match(text, /Japan trip/);
      assert.match(text, /month\(s\) saved/);
      await screenshot(page, "scenario-goal");
      await page.getByLabel("Scenario amount in rupees").fill("30000");
      assert.equal(await page.getByTestId("whatif-result").count(), 0);
      return text;
    }
  );
  await step(
    "Subscription cancellation what-if uses actual recurring payments without cancelling them",
    async () => {
      await page
        .locator("#whatif")
        .getByLabel("Scenario", { exact: true })
        .selectOption("cancel");
      await page
        .locator("#whatif")
        .getByLabel("Recurring payment", { exact: true })
        .selectOption({ label: "Netflix" });
      await page
        .getByRole("button", { name: "Run scenario", exact: true })
        .click();
      await page.getByTestId("whatif-result").waitFor();
      assert.match(
        await page.getByTestId("whatif-result").innerText(),
        /₹28,274.96/
      );
      assert.equal(
        (await rpc(context, "inari.getSnapshot")).monthlySurplus,
        27625.96
      );
    }
  );
  await step(
    "EMI reality check renders server-computed ₹40,700 total and ₹700 extra cost",
    async () => {
      await page
        .locator("#emi")
        .getByRole("button", { name: "Check", exact: true })
        .click();
      await page.getByTestId("emi-result").waitFor();
      const t = await page.getByTestId("emi-result").innerText();
      assert.match(t, /₹40,700/);
      assert.match(t, /₹700/);
      assert.equal(
        (await rpc(context, "inari.getSnapshot")).coverage.transactionCount,
        494
      );
      await screenshot(page, "emi-comparison");
    }
  );
  await step(
    "Advisor answers a ledger-grounded dining question and contextual follow-up",
    async () => {
      await visit(page, "/avatar");
      let a = await ask(page, "How much did I spend on dining last month?");
      assert.match(a.answer, /3,377/);
      assert.equal(a.engine.llmUsed, false);
      a = await ask(page, "What if I cut dining spending by 30 percent?");
      assert.ok(a.simulation);
      const before = a.simulation.metrics.find(
        m => m.label === "Monthly surplus"
      );
      a = await ask(page, "make it 50%");
      assert.ok(a.simulation);
      const after = a.simulation.metrics.find(
        m => m.label === "Monthly surplus"
      );
      assert.ok(after.scenario > before.scenario);
      await screenshot(page, "advisor-grounded");
      return { engine: a.engine, followUpSurplus: after.scenario };
    }
  );
  await step(
    "Reload preserves the demo identity and imported ledger",
    async () => {
      await page.reload();
      await page.waitForLoadState("networkidle");
      const s = await rpc(context, "inari.getSnapshot");
      assert.equal(s.coverage.transactionCount, 494);
      assert.equal(s.monthlySurplus, 27625.96);
    }
  );
  await step(
    "Digital PDF fixture uploads, previews, shows page evidence and commits",
    async () =>
      isolated(async (ctx, p) => {
        await visit(p, "/import");
        await p
          .getByLabel("Choose statement file (CSV or PDF)")
          .setInputFiles(
            path.resolve("client/public/demo/synthetic_statement.pdf")
          );
        await p.getByRole("button", { name: /Confirm import of/ }).waitFor();
        assert.match(await p.locator("#import-preview").innerText(), /PDF p\./);
        let n = Number(
          (
            await p
              .getByRole("button", { name: /Confirm import of/ })
              .innerText()
          ).match(/of (\d+)/)[1]
        );
        await commit(p, n);
        assert.equal(
          (await rpc(ctx, "inari.getSnapshot")).coverage.transactionCount,
          n
        );
        await screenshot(p, "pdf-evidence");
        return { written: n };
      })
  );
  await step(
    "SMS .txt upload previews and commits using an isolated identity",
    async () =>
      isolated(async (ctx, p) => {
        await visit(p, "/import");
        await p
          .getByLabel("Choose statement file (CSV or PDF)")
          .setInputFiles(path.resolve("client/public/demo/synthetic_sms.txt"));
        await p.getByRole("button", { name: /Confirm import of/ }).waitFor();
        const n = Number(
          (
            await p
              .getByRole("button", { name: /Confirm import of/ })
              .innerText()
          ).match(/of (\d+)/)[1]
        );
        assert.ok(n > 0);
        await commit(p, n);
        assert.equal(
          (await rpc(ctx, "inari.getSnapshot")).coverage.transactionCount,
          n
        );
        await screenshot(p, "sms-txt-import");
        return { written: n };
      })
  );
  await step(
    "SMS paste preview uses the actual parser and requires confirmation",
    async () =>
      isolated(async (ctx, p) => {
        await visit(p, "/import");
        const sms = fs.readFileSync(
          "client/public/demo/synthetic_sms.txt",
          "utf8"
        );
        await p.getByLabel("Or paste SMS bank alerts (one per line)").fill(sms);
        await p.getByRole("button", { name: "Preview SMS import" }).click();
        await p.getByRole("button", { name: /Confirm import of/ }).waitFor();
        assert.equal(
          (await rpc(ctx, "inari.getSnapshot")).coverage.transactionCount,
          0
        );
      })
  );
  await step(
    "Selective possible-duplicate review includes only the explicitly selected row",
    async () =>
      isolated(async (ctx, p) => {
        const first =
          "Date,Description,Debit,Credit\n01/09/2026,SALARY,,100000\n10/09/2026,UPI/CHAI POINT/chai@bank,250.00,\n11/09/2026,UPI/BOOK SHOP/books@bank,300.00,";
        await imported(ctx, p, first);
        await upload(
          p,
          "possible.csv",
          "Date,Description,Debit,Credit\n10/09/2026,SMS bank account debit: CHAI POINT,250.00,\n11/09/2026,SMS bank account debit: BOOK SHOP,300.00,"
        );
        await p.getByTestId("possible-duplicates").waitFor();
        assert.ok(
          await p
            .getByRole("button", { name: "Nothing to import" })
            .isDisabled()
        );
        const selected = p.getByRole("checkbox", { name: /Include row/ });
        assert.equal(await selected.count(), 2);
        await selected.first().check();
        await commit(p, 1);
        assert.equal(
          (await rpc(ctx, "inari.getSnapshot")).coverage.transactionCount,
          4
        );
        await screenshot(p, "selective-duplicate");
      })
  );
  await step(
    "Manual cash preview, confirm, repeated confirmation prevention and undo",
    async () =>
      isolated(async (ctx, p) => {
        await imported(
          ctx,
          p,
          fs.readFileSync("data/demo/fixture_debit_credit.csv", "utf8")
        );
        await visit(p, "/spending");
        await p
          .locator("#manual")
          .getByLabel("What happened?")
          .fill("I spent 350 cash on groceries yesterday");
        await p
          .locator("#manual")
          .getByRole("button", { name: "Preview", exact: true })
          .click();
        await p.getByTestId("manual-preview").waitFor();
        assert.equal(
          (await rpc(ctx, "inari.getSnapshot")).coverage.transactionCount,
          494
        );
        await p
          .getByRole("button", { name: "Confirm and add", exact: true })
          .click();
        await p.getByTestId("manual-done").waitFor();
        assert.equal(
          (await rpc(ctx, "inari.getSnapshot")).coverage.transactionCount,
          495
        );
        assert.equal(
          await p
            .getByRole("button", { name: "Confirm and add", exact: true })
            .count(),
          0
        );
        await p
          .getByTestId("manual-done")
          .getByRole("button", { name: "Undo", exact: true })
          .click();
        await p
          .getByTestId("manual-done")
          .filter({ hasText: "Entry removed." })
          .waitFor();
        assert.equal(
          (await rpc(ctx, "inari.getSnapshot")).coverage.transactionCount,
          494
        );
      })
  );
  const claimRows = ["Date,Description,Debit,Credit"];
  for (const m of ["07", "08", "09"])
    claimRows.push(
      `01/${m}/2026,NEFT ACME SALARY,,100000.00`,
      `10/${m}/2026,UPI/3/SWIGGY/sw@bank,6000.00,`
    );
  claimRows.push(
    "02/09/2026,AMAZON PAY HEADPHONES ORDER,4500.00,",
    "05/09/2026,DINNER AT RESTAURANT,3000.00,",
    "08/09/2026,AMAZON REFUND ORDER 4455,,4500.00",
    "09/09/2026,UPI/FRIEND RETURN/rahul@bank,,4500.00",
    "12/09/2026,UPI/RAHUL/rahul@bank/dinner share,,1200.00",
    "13/09/2026,UPI/RAHUL/rahul@bank/dinner share two,,800.00",
    "30/09/2026,UPI/CHAI POINT/c@bank,100.00,"
  );
  await step(
    "Browser reimbursement creation, two settlements, complete-month netting and undo",
    async () =>
      isolated(async (ctx, p) => {
        await imported(ctx, p, claimRows.join("\n"));
        const before = await rpc(ctx, "inari.monthlyReport", {
          month: "2026-09",
        });
        assert.deepEqual(
          [before.totals.income, before.totals.expenses],
          [106500, 9100]
        );
        await visit(p, "/spending");
        const claim = p.locator("#claims");
        await claim
          .getByLabel("Claim type", { exact: true })
          .selectOption("reimbursement");
        await claim
          .getByLabel("Search for the original payment")
          .fill("DINNER AT RESTAURANT");
        await claim.getByLabel("Original payment", { exact: true }).waitFor();
        await claim
          .getByLabel("Original payment", { exact: true })
          .selectOption({ index: 1 });
        await claim.getByLabel("Expected amount in rupees").fill("2000");
        await claim.getByLabel("From", { exact: true }).fill("Rahul");
        await claim
          .getByRole("button", { name: "Add claim", exact: true })
          .click();
        await p.getByTestId("claim").waitFor();
        assert.equal(
          (await rpc(ctx, "inari.monthlyReport", { month: "2026-09" })).totals
            .expenses,
          9100
        );
        await p
          .getByTestId("claim")
          .getByRole("button", { name: "Find matching credit" })
          .click();
        let line = p
          .getByTestId("claim")
          .locator("div.flex.flex-wrap")
          .filter({ hasText: /dinner share.*1,200/ })
          .last();
        await clickMutation(
          p,
          line.getByRole("button", { name: "Confirm this credit" }),
          "inari.confirmClaimMatch"
        );
        await p.waitForLoadState("networkidle");
        let rep = await rpc(ctx, "inari.monthlyReport", { month: "2026-09" });
        assert.deepEqual(
          [rep.totals.income, rep.totals.expenses],
          [105300, 7900]
        );
        line = p
          .getByTestId("claim")
          .locator("div.flex.flex-wrap")
          .filter({ hasText: /dinner share two.*800/ })
          .last();
        await clickMutation(
          p,
          line.getByRole("button", { name: "Confirm this credit" }),
          "inari.confirmClaimMatch"
        );
        await p.waitForLoadState("networkidle");
        rep = await rpc(ctx, "inari.monthlyReport", { month: "2026-09" });
        assert.deepEqual(
          [rep.totals.income, rep.totals.expenses],
          [104500, 7100]
        );
        assert.match(await p.getByTestId("claim").innerText(), /received/);
        await screenshot(p, "reimbursement-confirmed");
        for (let i = 0; i < 2; i++) {
          await p
            .getByTestId("claim")
            .getByRole("button", { name: "Undo", exact: true })
            .first()
            .click();
          await p.waitForLoadState("networkidle");
        }
        rep = await rpc(ctx, "inari.monthlyReport", { month: "2026-09" });
        assert.deepEqual(
          [rep.totals.income, rep.totals.expenses],
          [106500, 9100]
        );
        return {
          baseline: [106500, 9100],
          settled: [104500, 7100],
          restored: [rep.totals.income, rep.totals.expenses],
        };
      })
  );
  await step(
    "Refund claim creation and explicit matching-credit confirmation",
    async () =>
      isolated(async (ctx, p) => {
        await imported(ctx, p, claimRows.join("\n"));
        await visit(p, "/spending");
        const claim = p.locator("#claims");
        await claim
          .getByLabel("Search for the original payment")
          .fill("HEADPHONES");
        await claim.getByLabel("Original payment", { exact: true }).waitFor();
        await claim
          .getByLabel("Original payment", { exact: true })
          .selectOption({ index: 1 });
        await claim.getByLabel("Expected amount in rupees").fill("4500");
        await claim
          .getByRole("button", { name: "Add claim", exact: true })
          .click();
        await p
          .getByTestId("claim")
          .getByRole("button", { name: "Find matching credit" })
          .click();
        await p
          .getByTestId("claim")
          .locator("div.flex.flex-wrap")
          .filter({ hasText: /AMAZON REFUND ORDER/ })
          .last()
          .getByRole("button", { name: "Confirm this credit" })
          .click();
        await p.waitForLoadState("networkidle");
        const c = (await rpc(ctx, "inari.listClaims")).items[0];
        assert.equal(c.status, "received");
        assert.equal(c.outstandingAmountPaise, 0);
        await screenshot(p, "refund-confirmed");
      })
  );
  await step(
    "Import undo removes only the confirmed batch after explicit confirmation",
    async () =>
      isolated(async (ctx, p) => {
        await imported(
          ctx,
          p,
          "Date,Description,Debit,Credit\n01/09/2026,SYNTHETIC SALARY,,10000\n02/09/2026,SYNTHETIC PURCHASE,100,"
        );
        p.once("dialog", d => d.accept());
        await p
          .getByRole("button", { name: "Undo import", exact: true })
          .click();
        await p
          .getByTestId("import-done")
          .filter({ hasText: "Undid import" })
          .waitFor();
        assert.equal(
          (await rpc(ctx, "inari.getSnapshot")).coverage.transactionCount,
          0
        );
      })
  );
  await step(
    "A separate browser identity cannot see the canonical ledger",
    async () =>
      isolated(async (ctx, p) => {
        await visit(p, "/import");
        assert.equal(
          (await rpc(ctx, "inari.getSnapshot")).coverage.transactionCount,
          0
        );
        assert.equal(await p.getByTestId("ledger-summary").count(), 0);
      })
  );
  await step(
    "Four viewport full-page captures; no document overflow across all required routes",
    async () => {
      const issues = [];
      for (const [label, width, height] of [
        ["desktop", 1440, 900],
        ["laptop", 1366, 768],
        ["tablet", 768, 1024],
        ["mobile", 390, 844],
      ]) {
        await page.setViewportSize({ width, height });
        for (const route of [
          "/",
          "/dashboard",
          "/import",
          "/spending",
          "/goals",
          "/recommendations",
          "/avatar",
        ]) {
          await visit(page, route);
          await screenshot(
            page,
            (route === "/" ? "landing" : route.slice(1)) + "-" + label
          );
          const size = await page.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          if (size.scroll > width + 1) {
            const elements = await page.evaluate(() =>
              [...document.querySelectorAll("body *")]
                .filter(
                  e =>
                    e.getBoundingClientRect().right > innerWidth + 1 &&
                    !e.closest(".overflow-auto,.overflow-x-auto")
                )
                .map(e => ({
                  tag: e.tagName,
                  className: typeof e.className === "string" ? e.className : "",
                  text: e.textContent?.slice(0, 80),
                  right: e.getBoundingClientRect().right,
                }))
                .slice(-20)
            );
            issues.push({ route, width, ...size, elements });
          }
        }
        await visit(page, "/");
        const h = page.locator("h1");
        const box = await h.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
        if (width < 1024) {
          await page
            .getByRole("button", { name: "Open navigation menu" })
            .click();
          await page
            .getByRole("navigation", { name: "Mobile primary navigation" })
            .getByRole("link", { name: "Open application" })
            .click();
          await page
            .getByRole("heading", { name: "Import Center", exact: true })
            .waitFor();
        }
        if (width < 1280) {
          await visit(page, "/dashboard");
          await page
            .getByRole("button", { name: "Open dashboard navigation" })
            .click();
          await page
            .getByRole("navigation", { name: "Mobile dashboard navigation" })
            .getByRole("link", { name: "Goals", exact: true })
            .click();
          await page.locator("#my-goals").waitFor();
          await page
            .getByTestId("goal")
            .getByRole("button", { name: "Edit", exact: true })
            .click();
          await page
            .locator("#my-goals")
            .getByLabel("Monthly contribution in rupees")
            .fill("20000");
          await page
            .locator("#my-goals")
            .getByRole("button", { name: "Save changes", exact: true })
            .click();
          await page.waitForLoadState("networkidle");
        }
      }
      assert.deepEqual(issues, []);
      return {
        sizes: [1440, 1366, 768, 390],
        routes: 7,
        captures: 28,
        overflow: issues,
      };
    }
  );
  await step("No browser runtime exceptions in the main journey", async () =>
    assert.deepEqual(pageErrors, [])
  );
  fs.writeFileSync(
    path.join(
      OUT,
      process.env.INARI_ACCEPTANCE_REPORT || "acceptance-results.json"
    ),
    JSON.stringify(
      {
        base: BASE,
        runAt: new Date().toISOString(),
        browser: "Playwright / Chrome, production build",
        results,
        passed: results.filter(r => r.status === "PASS").length,
        failed: results.filter(r => r.status === "FAIL").length,
      },
      null,
      2
    )
  );
  await context.close();
  await browser.close();
  process.exitCode = results.some(r => r.status === "FAIL") ? 1 : 0;
})().catch(async e => {
  console.error(e);
  if (browser) await browser.close();
  process.exitCode = 1;
});
