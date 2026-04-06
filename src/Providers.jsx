import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./wagmi.config";

import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

// ─── Custom RainbowKit theme matching TempoNFT design system ──────────────────
const tempoTheme = darkTheme({
  accentColor: "#22D3EE",
  accentColorForeground: "#0B0F14",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={tempoTheme}
          appInfo={{
            appName: "TempoNFT",
            learnMoreUrl: "https://tempoxyz.io",
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
