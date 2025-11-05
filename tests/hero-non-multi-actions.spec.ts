import { expect, test } from "@playwright/test";

test.describe("Hero non multi-choice market actions", () => {
  test("align buttons vertically at the center of their container", async ({ page }) => {
    await page.goto("/");
    const actions = page.getByTestId("hero-preview-actions").first();
    await expect(actions).toBeVisible();

    const buttons = actions.getByRole("button");
    await expect(buttons).toHaveCount(2);

    const containerBox = await actions.boundingBox();
    expect(containerBox).not.toBeNull();

    const [yesBox, noBox] = await Promise.all([
      buttons.nth(0).boundingBox(),
      buttons.nth(1).boundingBox()
    ]);

    expect(yesBox).not.toBeNull();
    expect(noBox).not.toBeNull();

    if (!containerBox || !yesBox || !noBox) return;

    const containerCenterY = containerBox.y + containerBox.height / 2;
    const yesCenterY = yesBox.y + yesBox.height / 2;
    const noCenterY = noBox.y + noBox.height / 2;

    expect(Math.abs(yesCenterY - containerCenterY)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(noCenterY - containerCenterY)).toBeLessThanOrEqual(1.5);

    const yesDisplay = await buttons.nth(0).evaluate((element) => getComputedStyle(element).display);
    const noDisplay = await buttons.nth(1).evaluate((element) => getComputedStyle(element).display);

    expect(yesDisplay).toBe("flex");
    expect(noDisplay).toBe("flex");

    const yesHeight = await buttons.nth(0).evaluate((element) => element.getBoundingClientRect().height);
    const noHeight = await buttons.nth(1).evaluate((element) => element.getBoundingClientRect().height);

    expect(yesHeight).toBeGreaterThanOrEqual(36);
    expect(noHeight).toBeGreaterThanOrEqual(36);
  });
});
