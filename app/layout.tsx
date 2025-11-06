import "./globals.css";
import { getMarkets } from "@/lib/markets";
import AppHeader from "@/components/layout/AppHeader";
import { HeroCarouselProvider } from "@/components/home/HeroCarouselContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import WalletProviders from "@/components/auth/WalletProviders";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata = {
  title: "Kerdos — Demo Web",
  description: "Open a market with Wallet Adapter + Anchor"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const markets = getMarkets();
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || "";
  const csp = `default-src 'self'; connect-src 'self' ${rpc} ws: wss:; img-src 'self' data: https://images.unsplash.com https://source.unsplash.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline' 'unsafe-eval';`;
  const themeInitScript = `(() => {
    try {
      var key = "kerdos-theme";
      var stored = window.localStorage.getItem(key);
      var theme = stored === "light" || stored === "dark" ? stored : "light";
      document.documentElement.setAttribute("data-theme", theme);
    } catch (error) {
      document.documentElement.setAttribute("data-theme", "light");
    }
  })();`;
  return (
    <html lang="es" data-theme="dark" data-variant="blue">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={csp} />
        <meta name="referrer" content="no-referrer" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <WalletProviders>
            <AuthProvider>
              <HeroCarouselProvider markets={markets}>
                <AppHeader markets={markets} />
                <div className="app-content">{children}</div>
              </HeroCarouselProvider>
            </AuthProvider>
          </WalletProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
