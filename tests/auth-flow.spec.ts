import { test, expect } from "@playwright/test";
import { encode } from "@auth/core/jwt";

const AUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "playwright-secret";
const TEST_WALLETS = {
  phantom: [
    187, 136, 100, 68, 201, 105, 27, 96, 250, 200, 15, 132, 0, 25, 20, 181, 253, 2, 73, 66, 61, 47, 255, 224, 58,
    37, 28, 101, 88, 212, 23, 61, 56, 58, 148, 6, 209, 84, 159, 167, 174, 156, 120, 82, 242, 54, 77, 62, 58, 156,
    68, 192, 116, 208, 87, 29, 255, 174, 236, 86, 35, 120, 50, 245
  ],
  solflare: [
    141, 236, 208, 140, 233, 173, 13, 92, 78, 31, 80, 120, 58, 85, 180, 102, 83, 172, 210, 200, 220, 243, 182, 31, 0,
    214, 190, 214, 3, 254, 221, 231, 150, 30, 95, 191, 54, 32, 75, 14, 233, 37, 201, 203, 108, 197, 128, 207, 60, 74,
    216, 113, 64, 194, 209, 139, 99, 43, 248, 95, 64, 117, 93, 169
  ]
} as const;

async function setSessionCookie(page, payload) {
  const token = await encode({
    token: payload,
    secret: AUTH_SECRET,
    maxAge: 60 * 60,
    salt: "next-auth.session-token"
  });
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      url: "http://127.0.0.1:5173/"
    }
  ]);
}

test.describe("Autenticación", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.log(`[browser:error] ${message.text()}`);
      }
    });
  });
  test("abre y cierra el modal desde el header", async ({ page }) => {
    await page.addInitScript(
      ({
        wallets,
        automation
      }: {
        wallets: typeof TEST_WALLETS;
        automation: { wallet: Partial<Record<keyof typeof TEST_WALLETS, { publicKey: string }> > };
      }) => {
      // @ts-expect-error instrumentation for Playwright tests
        globalThis.__KERDOS_TEST_WALLETS__ = wallets;
      // @ts-expect-error instrumentation for Playwright tests
        globalThis.__KERDOS_AUTOMATION__ = automation;
      },
      {
        wallets: TEST_WALLETS,
        automation: {
          wallet: {
            phantom: { publicKey: "AutomationPhantomPublicKey" },
            solflare: { publicKey: "AutomationSolflarePublicKey" }
          }
        }
      }
    );

    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("dialog", { name: /Inicia sesión|Crea tu cuenta/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("Continuar con Google inicia el flujo OAuth de Google", async ({ page }) => {
    await page.route("https://accounts.google.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Google OAuth Stub</body></html>"
      });
    });
    await page.addInitScript(
      ({
        wallets,
        automation
      }: {
        wallets: typeof TEST_WALLETS;
        automation: { wallet: Partial<Record<keyof typeof TEST_WALLETS, { publicKey: string }> > };
      }) => {
        // @ts-expect-error instrumentation for Playwright tests
        globalThis.__KERDOS_TEST_WALLETS__ = wallets;
        // @ts-expect-error instrumentation for Playwright tests
        globalThis.__KERDOS_AUTOMATION__ = automation;
      },
      {
        wallets: TEST_WALLETS,
        automation: {
          wallet: {
            phantom: { publicKey: "AutomationPhantomPublicKey" },
            solflare: { publicKey: "AutomationSolflarePublicKey" }
          }
        }
      }
    );

    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    const [request] = await Promise.all([
      page.waitForRequest((request) => request.url().includes("/api/auth/signin/google")),
      page.getByRole("button", { name: "Continuar con Google" }).click()
    ]);
    expect(request.method()).toBe("POST");
    const signinUrl = new URL(request.url());
    expect(signinUrl.pathname).toBe("/api/auth/signin/google");
    const requestBody = request.postData() ?? "";
    const formData = new URLSearchParams(requestBody);
    expect(formData.has("callbackUrl")).toBe(true);
    expect(formData.get("callbackUrl")).toContain("/");
    expect(formData.has("csrfToken")).toBe(true);
    await page.waitForURL(/accounts\.google\.com/);
  });

  test("la cabecera muestra el menú después de una sesión activa", async ({ page }) => {
    let sessionIntercepted = false;
    await page.route("**/api/auth/session", async (route) => {
      if (sessionIntercepted) {
        await route.continue();
        return;
      }
      sessionIntercepted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "google-test-user",
            name: "Usuario Google",
            email: "google@example.com",
            image: "https://dummyimage.com/80x80/1f2937/f8fafc?text=G",
            provider: "google"
          },
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      });
      await page.unroute("**/api/auth/session");
    });

    await setSessionCookie(page, {
      sub: "google-test-user",
      name: "Usuario Google",
      email: "google@example.com",
      picture: "https://dummyimage.com/80x80/1f2937/f8fafc?text=G",
      provider: "google"
    });
    await page.goto("/");
    const avatarButton = page.locator('[aria-haspopup="menu"]');
    await expect(avatarButton).toBeVisible();
    await avatarButton.click();
    await expect(page.getByRole("menuitem", { name: "Perfil" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Cerrar sesión" })).toBeVisible();
  });

  test("inicia sesión con Phantom y persiste tras recargar", async ({ page }) => {
    const walletUser = {
      id: "phantom-wallet-user",
      name: "Wallet Phantom",
      email: null,
      image: null,
      provider: "wallet",
      walletType: "phantom"
    };

    let walletSessionActive = false;

    await page.route("**/api/auth/session", async (sessionRoute) => {
      if (!walletSessionActive) {
        await sessionRoute.continue();
        return;
      }
      await sessionRoute.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: walletUser,
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      });
    });

    await page.route("**/api/siws/verify", async (route) => {
      walletSessionActive = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await page.goto("/");
    await page.evaluate(
      ({ wallets, automation }: { wallets: typeof TEST_WALLETS; automation: unknown }) => {
        // @ts-expect-error instrumentation for Playwright tests
        globalThis.__KERDOS_TEST_WALLETS__ = wallets;
        // @ts-expect-error instrumentation for Playwright tests
        globalThis.__KERDOS_AUTOMATION__ = automation;
      },
      {
        wallets: TEST_WALLETS,
        automation: {
          wallet: {
            phantom: { publicKey: "AutomationPhantomPublicKey" },
            solflare: { publicKey: "AutomationSolflarePublicKey" }
          }
        }
      }
    );
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    const verifyRequest = page.waitForRequest((request) => request.url().includes("/api/siws/verify"));
    await page.getByRole("button", { name: "Conectar con Phantom" }).click();
    await verifyRequest;
    const avatarButton = page.locator('[aria-haspopup="menu"]');
    await expect(avatarButton).toBeVisible();
    await page.reload();
    await expect(page.locator('[aria-haspopup="menu"]').first()).toBeVisible();
    await page.locator('[aria-haspopup="menu"]').first().click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("inicia sesión con Solflare y muestra el menú", async ({ page }) => {
    const walletUser = {
      id: "solflare-wallet-user",
      name: "Wallet Solflare",
      email: null,
      image: null,
      provider: "wallet",
      walletType: "solflare"
    };

    let solflareSessionActive = false;

    await page.route("**/api/auth/session", async (sessionRoute) => {
      if (!solflareSessionActive) {
        await sessionRoute.continue();
        return;
      }
      await sessionRoute.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: walletUser,
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      });
    });

    await page.route("**/api/siws/verify", async (route) => {
      solflareSessionActive = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });
    await page.goto("/");
    await page.evaluate(
      ({ wallets, automation }: { wallets: typeof TEST_WALLETS; automation: unknown }) => {
        // @ts-expect-error instrumentation for Playwright tests
        globalThis.__KERDOS_TEST_WALLETS__ = wallets;
        // @ts-expect-error instrumentation for Playwright tests
        globalThis.__KERDOS_AUTOMATION__ = automation;
      },
      {
        wallets: TEST_WALLETS,
        automation: {
          wallet: {
            phantom: { publicKey: "AutomationPhantomPublicKey" },
            solflare: { publicKey: "AutomationSolflarePublicKey" }
          }
        }
      }
    );
    await page.getByRole("button", { name: "Registrarse" }).click();
    const verifyRequest = page.waitForRequest((request) => request.url().includes("/api/siws/verify"));
    await page.getByRole("button", { name: "Conectar con Solflare" }).click();
    await verifyRequest;
    await expect(page.locator('[aria-haspopup="menu"]').first()).toBeVisible();
  });
});
