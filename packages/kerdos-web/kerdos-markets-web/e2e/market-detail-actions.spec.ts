import { test, expect } from "@playwright/test";

test.describe("market detail action buttons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/markets/cr-elecciones-ganador-2026");
    await page.waitForSelector("[data-market-action-buttons]");
  });

  test("render prices and remain responsive across breakpoints", async ({ page }) => {
    const container = page.locator("[data-market-action-buttons]");
    const yesButton = page.locator("[data-market-action='yes']");
    const noButton = page.locator("[data-market-action='no']");

    const yesPrice = page.getByTestId("market-action-price-yes");
    const noPrice = page.getByTestId("market-action-price-no");

    await expect(yesButton).toBeVisible();
    await expect(noButton).toBeVisible();
    await expect(yesButton).not.toContainText("¢");
    await expect(noButton).not.toContainText("¢");
    await expect(yesButton).not.toContainText("—");
    await expect(noButton).not.toContainText("—");
    await expect(yesPrice).toHaveText(/^\$\d+\.\d{2}$/);
    await expect(noPrice).toHaveText(/^\$\d+\.\d{2}$/);

    const yesLabel = page.getByTestId("market-action-label-yes");
    const noLabel = page.getByTestId("market-action-label-no");
    const chartCard = page.getByTestId("market-chart-card");
    const heroIdentity = page.getByTestId("market-hero");
    const heroCard = page.getByTestId("market-hero-card");
    const rulesPanel = page.getByTestId("market-rules-panel");
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
      throw new Error("Failed to measure button contents");
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
      throw new Error("Failed to measure action buttons on desktop layout");
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
      throw new Error("Failed to measure action buttons on mobile layout");
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

  test("hover and active states adjust background color", async ({ page }) => {
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
});
