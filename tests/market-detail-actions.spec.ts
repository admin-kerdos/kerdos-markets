import { expect, test } from "@playwright/test";

const DETAIL_PATH = "/markets/sol-ath-2025";

test.describe("Market detail action buttons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DETAIL_PATH);
    await page.waitForSelector("[data-market-action-buttons]");
  });

  test.afterEach(async ({ page }) => {
    const modal = page.locator("[data-trade-modal]");
    if ((await modal.count()) > 0 && (await modal.first().isVisible())) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(50);
    }
  });

  test("render prices and remain responsive across breakpoints", async ({ page }) => {
    const container = page.locator("[data-market-action-buttons]");
    const yesButton = page.locator("[data-market-action='yes']");
    const noButton = page.locator("[data-market-action='no']");
    const yesPrice = page.getByTestId("market-action-price-yes");
    const noPrice = page.getByTestId("market-action-price-no");
    const yesLabel = page.getByTestId("market-action-label-yes");
    const noLabel = page.getByTestId("market-action-label-no");
    const chartCard = page.getByTestId("market-chart-card");
    const heroIdentity = page.getByTestId("market-hero");
    const heroCard = page.getByTestId("market-hero-card");
    const rulesPanel = page.getByTestId("market-rules-panel");

    await expect(yesButton).toBeVisible();
    await expect(noButton).toBeVisible();
    await expect(yesButton).not.toContainText("¢");
    await expect(noButton).not.toContainText("¢");
  await expect(yesButton).not.toContainText("—");
  await expect(noButton).not.toContainText("—");
  await expect(yesPrice).toHaveText(/^\$\d+\.\d{2}$/);
  await expect(noPrice).toHaveText(/^\$\d+\.\d{2}$/);
  await expect(yesLabel).toHaveText("Sí");
  await expect(noLabel).toHaveText("No");

    const yesFlex = await yesButton.evaluate((node) => {
      const { justifyContent, alignItems, textAlign } = getComputedStyle(node);
      return { justifyContent, alignItems, textAlign };
    });
    const noFlex = await noButton.evaluate((node) => {
      const { justifyContent, alignItems, textAlign } = getComputedStyle(node);
      return { justifyContent, alignItems, textAlign };
    });

    expect(yesFlex.justifyContent).toBe("center");
    expect(yesFlex.alignItems).toBe("center");
    expect(yesFlex.textAlign).toBe("center");
  expect(noFlex.justifyContent).toBe("center");
  expect(noFlex.alignItems).toBe("center");
  expect(noFlex.textAlign).toBe("center");

  const yesPadding = await yesButton.evaluate((node) => {
    const styles = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return {
      top: parseFloat(styles.paddingTop),
      bottom: parseFloat(styles.paddingBottom),
      height: rect.height
    };
  });
  const noPadding = await noButton.evaluate((node) => {
    const styles = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return {
      top: parseFloat(styles.paddingTop),
      bottom: parseFloat(styles.paddingBottom),
      height: rect.height
    };
  });

  expect(yesPadding.top).toBeLessThanOrEqual(18);
  expect(yesPadding.bottom).toBeLessThanOrEqual(18);
  expect(yesPadding.height).toBeLessThanOrEqual(68);
  expect(noPadding.top).toBeLessThanOrEqual(18);
  expect(noPadding.bottom).toBeLessThanOrEqual(18);
  expect(noPadding.height).toBeLessThanOrEqual(68);

    const yesLabelBox = await yesLabel.boundingBox();
    const yesPriceBox = await yesPrice.boundingBox();
    const noLabelBox = await noLabel.boundingBox();
    const noPriceBox = await noPrice.boundingBox();

    if (!yesLabelBox || !yesPriceBox || !noLabelBox || !noPriceBox) {
      throw new Error("No se pudieron medir las etiquetas internas de los botones");
    }

    const centerDelta = (boxA: { y: number; height: number }, boxB: { y: number; height: number }) => {
      const centerA = boxA.y + boxA.height / 2;
      const centerB = boxB.y + boxB.height / 2;
      return Math.abs(centerA - centerB);
    };

    expect(centerDelta(yesLabelBox, yesPriceBox)).toBeLessThanOrEqual(2);
    expect(centerDelta(noLabelBox, noPriceBox)).toBeLessThanOrEqual(2);

    await page.setViewportSize({ width: 1280, height: 900 });

    const containerDesktopBox = await container.boundingBox();
    const yesDesktopBox = await yesButton.boundingBox();
    const noDesktopBox = await noButton.boundingBox();
    const chartDesktopBox = await chartCard.boundingBox();
    const heroDesktopBox = await heroIdentity.boundingBox();
    const heroCardDesktopBox = await heroCard.boundingBox();
    const rulesDesktopBox = await rulesPanel.boundingBox();

    if (
      !containerDesktopBox ||
      !yesDesktopBox ||
      !noDesktopBox ||
      !chartDesktopBox ||
      !heroDesktopBox ||
      !heroCardDesktopBox ||
      !rulesDesktopBox
    ) {
      throw new Error("No se pudieron medir los botones en escritorio");
    }

    expect(yesDesktopBox.width).toBeGreaterThanOrEqual(containerDesktopBox.width * 0.45);
    expect(noDesktopBox.width).toBeGreaterThanOrEqual(containerDesktopBox.width * 0.45);
    expect(Math.abs(yesDesktopBox.y - noDesktopBox.y)).toBeLessThanOrEqual(8);

    const desktopGap = yesDesktopBox.y - (chartDesktopBox.y + chartDesktopBox.height);
    expect(desktopGap).toBeGreaterThan(4);
    expect(desktopGap).toBeLessThanOrEqual(48);
    const heroCardDesktopPaddingLeft = await heroCard.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).paddingLeft || "0")
    );
    const expectedHeroDesktopLeft = heroCardDesktopBox.x + heroCardDesktopPaddingLeft;
    expect(Math.abs(heroDesktopBox.x - expectedHeroDesktopLeft)).toBeLessThanOrEqual(4);
    expect(Math.abs(chartDesktopBox.x - expectedHeroDesktopLeft)).toBeLessThanOrEqual(4);
    if (rulesDesktopBox) {
      expect(Math.abs(rulesDesktopBox.x - expectedHeroDesktopLeft)).toBeLessThanOrEqual(4);
    }

    await page.setViewportSize({ width: 480, height: 900 });
    await page.waitForTimeout(150);

    const containerMobileBox = await container.boundingBox();
    const yesMobileBox = await yesButton.boundingBox();
    const noMobileBox = await noButton.boundingBox();
    const chartMobileBox = await chartCard.boundingBox();
    const heroMobileBox = await heroIdentity.boundingBox();
    const heroCardMobileBox = await heroCard.boundingBox();
    const rulesMobileBox = await rulesPanel.boundingBox();

    if (
      !containerMobileBox ||
      !yesMobileBox ||
      !noMobileBox ||
      !chartMobileBox ||
      !heroMobileBox ||
      !heroCardMobileBox ||
      !rulesMobileBox
    ) {
      throw new Error("No se pudieron medir los botones en móvil");
    }

    expect(noMobileBox.y).toBeGreaterThan(yesMobileBox.y + yesMobileBox.height - 4);
    expect(yesMobileBox.width).toBeGreaterThanOrEqual(containerMobileBox.width * 0.88);
    expect(noMobileBox.width).toBeGreaterThanOrEqual(containerMobileBox.width * 0.88);

    const mobileGap = yesMobileBox.y - (chartMobileBox.y + chartMobileBox.height);
    expect(mobileGap).toBeGreaterThan(4);
    expect(mobileGap).toBeLessThanOrEqual(48);
    const heroCardMobilePaddingLeft = await heroCard.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).paddingLeft || "0")
    );
    const expectedHeroMobileLeft = heroCardMobileBox.x + heroCardMobilePaddingLeft;
    expect(Math.abs(heroMobileBox.x - expectedHeroMobileLeft)).toBeLessThanOrEqual(4);
    expect(Math.abs(chartMobileBox.x - expectedHeroMobileLeft)).toBeLessThanOrEqual(4);
    if (rulesMobileBox) {
      expect(Math.abs(rulesMobileBox.x - expectedHeroMobileLeft)).toBeLessThanOrEqual(4);
    }
  });

  test("hover y active cambian los colores de fondo", async ({ page }) => {
    const yesButton = page.locator("[data-market-action='yes']");
    const noButton = page.locator("[data-market-action='no']");
    const overlay = page.locator("[data-trade-modal-overlay]");

    if ((await overlay.count()) > 0 && (await overlay.first().isVisible())) {
      await page.keyboard.press("Escape");
      await overlay.first().waitFor({ state: "detached" });
    }

    const yesBase = await yesButton.evaluate((node) => getComputedStyle(node).backgroundColor);
    await yesButton.hover();
    await page.mouse.down();
    await page.waitForTimeout(40);
    const yesActive = await yesButton.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(yesActive).not.toBe(yesBase);
    await page.mouse.up();
    await page.mouse.move(0, 0);

    if ((await overlay.count()) > 0 && (await overlay.first().isVisible())) {
      await page.keyboard.press("Escape");
      await overlay.first().waitFor({ state: "detached" });
    }

    const noBase = await noButton.evaluate((node) => getComputedStyle(node).backgroundColor);
    await noButton.hover();
    await page.mouse.down();
    await page.waitForTimeout(40);
    const noActive = await noButton.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(noActive).not.toBe(noBase);
    await page.mouse.up();
    await page.mouse.move(0, 0);
  });

  test("abre modal al hacer clic y muestra datos del mercado", async ({ page }) => {
    await page.getByRole("button", { name: /^Sí/ }).click();

    const modal = page.locator("[data-trade-modal]");
    await expect(modal).toBeVisible();
    await expect(modal.locator("[data-trade-modal-selected-action]")).toHaveText(/Comprar Sí/i);
    await expect(modal.locator("h2")).toContainText("¿Solana va superar");
    await expect(modal.locator("[data-trade-modal-side='yes']")).toContainText("Sí");
    await expect(modal.locator("[data-trade-modal-side='no']")).toContainText("No");

    await expect(page.locator("text=Moneda")).toHaveCount(0);
    await expect(page.locator("text=Costo total")).toHaveCount(0);
    await expect(page.locator("text=Contratos comprados")).toHaveCount(0);

    const box = await modal.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(440);
      expect(box.height).toBeLessThanOrEqual(520);
    }

    const background = await modal
      .locator("[data-trade-modal-selected-action]")
      .evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(background).toBe("rgba(0, 0, 0, 0)");
  });

  test("actualiza total y pago potencial según la entrada", async ({ page }) => {
    await page.getByRole("button", { name: /^No/ }).click();

    const amount = page.locator("[data-trade-modal-amount]");
    const estimateContainer = page.locator("[data-trade-modal-estimate]");
    const estimateValue = page.locator("[data-trade-modal-estimated]");

    const price = await page.evaluate(() => {
      const text = document.querySelector("[data-trade-modal-side='no']")?.textContent ?? "";
      const match = text.match(/\$([\d.,]+)/);
      if (!match) return null;
      return Number.parseFloat(match[1].replace(",", "."));
    });
    expect(price).not.toBeNull();

    await expect(estimateContainer).toHaveCount(0);

    await amount.fill("");
    await amount.fill("100");

    const priceDecimal = price ?? 0;
    const expectedBuyContracts = priceDecimal > 0 ? 100 / priceDecimal : 0;

    await expect(estimateContainer).toHaveCount(1);
    const displayedBuy = await estimateValue.textContent();
    const numericBuy = Number.parseFloat((displayedBuy ?? "").replace("$", ""));
    expect(numericBuy).not.toBeNaN();
    expect(Math.abs(numericBuy - expectedBuyContracts)).toBeLessThan(0.2);

    await page.locator("[data-trade-modal-sell]").click();
    await page.waitForTimeout(80);
    const sellPriceDecimal = 1 - priceDecimal;
    const expectedSellContracts = sellPriceDecimal > 0 ? 100 / sellPriceDecimal : 0;
    const displayedSell = await estimateValue.textContent();
    const numericSell = Number.parseFloat((displayedSell ?? "").replace("$", ""));
    expect(numericSell).not.toBeNaN();
    expect(Math.abs(numericSell - expectedSellContracts)).toBeLessThan(0.2);
  });

  test("cierra modal con escape y al pulsar fuera", async ({ page }) => {
    await page.getByRole("button", { name: /^Sí/ }).click();
    const modal = page.locator("[data-trade-modal]");
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();

    await page.getByRole("button", { name: /^No/ }).click();
    await expect(modal).toBeVisible();

    await page.locator("[data-trade-modal-overlay]").click({ position: { x: 5, y: 5 } });
    await expect(modal).toBeHidden();
  });

  test("modal ocupa el ancho completo en móvil", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.getByRole("button", { name: /^Sí/ }).click();

    const modal = page.locator("[data-trade-modal]");
    await expect(modal).toBeVisible();

    const modalBox = await modal.boundingBox();
    expect(modalBox).not.toBeNull();
    if (modalBox) {
      expect(modalBox.width).toBeGreaterThanOrEqual(320);
    }
  });
});
