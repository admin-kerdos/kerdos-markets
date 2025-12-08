import { expect, test } from "@playwright/test";

const MULTI_MARKET_PATH = "/markets/cr-elecciones-ganador-2026";

test.describe("Multi-option market detail page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(MULTI_MARKET_PATH);
    await page.waitForSelector("[data-market-option-row]");
  });

  test.afterEach(async ({ page }) => {
    const modal = page.locator("[data-trade-modal]");
    if ((await modal.count()) > 0 && (await modal.first().isVisible())) {
      await page.keyboard.press("Escape");
      await modal.first().waitFor({ state: "hidden" });
    }
  });

  test("renders every candidate with probability and actions", async ({ page }) => {
    const rows = page.locator("[data-market-option-row]");
    await expect(rows).toHaveCount(3);

    const extractedNames: string[] = [];
    const count = await rows.count();
    for (let index = 0; index < count; index += 1) {
      extractedNames.push(await rows.nth(index).locator("[data-market-option-name]").innerText());
    }
    expect(extractedNames).toEqual([
      "Laura Fernández",
      "Juan Carlos Hidalgo",
      "Álvaro Ramos"
    ]);

    const probabilities = page.locator("[data-market-option-probability]");
    await expect(probabilities.nth(0)).toHaveText("56%");
    await expect(probabilities.nth(1)).toHaveText("32%");
    await expect(probabilities.nth(2)).toHaveText("12%");

    await expect(rows.nth(0).locator("[data-market-option-action='yes']")).toBeVisible();
    await expect(rows.nth(0).locator("[data-market-option-action='no']")).toBeVisible();
  });

  test("trade buttons open modal per candidate without leaking state", async ({ page }) => {
    const firstRow = page.locator("[data-market-option-row]").first();
    await firstRow.locator("[data-market-option-action='yes']").click();

    const modal = page.locator("[data-trade-modal]");
    await expect(modal).toBeVisible();
    await expect(modal.locator("h2")).toContainText("Laura Fernández");
    await expect(modal.locator("[data-trade-modal-selected-action]")).toContainText(/Comprar Sí/i);

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();

    const secondRow = page.locator("[data-market-option-row]").nth(1);
    await secondRow.locator("[data-market-option-action='no']").click();

    await expect(modal).toBeVisible();
    await expect(modal.locator("h2")).toContainText("Juan Carlos Hidalgo");
    await expect(modal.locator("[data-trade-modal-selected-action]")).toContainText(/Comprar No/i);
  });

  test("rows remain single-line across responsive breakpoints", async ({ page }) => {
    const viewports = [
      { width: 1440, height: 900 },
      { width: 1024, height: 900 },
      { width: 414, height: 900 },
      { width: 360, height: 640 }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(80);

      const rows = await page.locator("[data-market-option-row]").elementHandles();
      for (const handle of rows) {
        const rowBox = await handle.boundingBox();
        expect(rowBox).not.toBeNull();
        if (!rowBox) continue;

        const row = handle.asElement();
        if (!row) continue;

        const nameHandle = await row.$("[data-market-option-name]");
        const probHandle = await row.$("[data-market-option-probability]");
        const yesHandle = await row.$("[data-market-option-action='yes']");
        const noHandle = await row.$("[data-market-option-action='no']");

        if (!nameHandle || !probHandle || !yesHandle || !noHandle) {
          throw new Error("Incomplete option row structure");
        }

        const [nameBox, probBox, yesBox, noBox, display, gridTemplate] = await Promise.all([
          nameHandle.boundingBox(),
          probHandle.boundingBox(),
          yesHandle.boundingBox(),
          noHandle.boundingBox(),
          row.evaluate((node) => getComputedStyle(node).display),
          row.evaluate((node) => getComputedStyle(node).gridTemplateColumns)
        ]);

        if (!nameBox || !probBox || !yesBox || !noBox) {
          throw new Error("Unable to measure multi-option layout");
        }

        expect(display).toBe("grid");
        const columns = gridTemplate
          .trim()
          .split(/\s+/)
          .filter((part) => part.length > 0);

        expect(columns.length).toBeGreaterThanOrEqual(4);
        const actionableColumns = columns.slice(-2);
        for (const value of actionableColumns) {
          const numeric = Number.parseFloat(value);
          expect(Number.isNaN(numeric)).toBe(false);
          expect(numeric).toBeGreaterThan(0);
        }

        const align = (boxA: { y: number; height: number }, boxB: { y: number; height: number }) => {
          const centerA = boxA.y + boxA.height / 2;
          const centerB = boxB.y + boxB.height / 2;
          return Math.abs(centerA - centerB);
        };

        expect(align(nameBox, probBox)).toBeLessThanOrEqual(2);
        expect(align(probBox, yesBox)).toBeLessThanOrEqual(2);
        expect(align(yesBox, noBox)).toBeLessThanOrEqual(2);

        expect(noBox.x + noBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);

        const whiteSpace = await nameHandle.evaluate(
          (node) => getComputedStyle(node).whiteSpace
        );
        expect(whiteSpace).toBe("nowrap");
      }
    }
  });
});
