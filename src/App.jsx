import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider, http } from "wagmi";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

import Layout from "./components/Layout.jsx";
import Market from "./pages/Market.jsx";
import CollectionPage from "./pages/CollectionPage.jsx";
import LaunchpadPage from "./pages/LaunchpadPage.jsx";
import MintPage from "./pages/MintPage.jsx";
import NFTItemPage from "./pages/NFTItemPage.jsx";
import PortfolioPage from "./pages/PortfolioPage.jsx";
import ApplicationPage from "./pages/ApplicationPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import StudioPage from "./pages/StudioPage.jsx";
import CollectionManagerPage from "./pages/CollectionManagerPage.jsx";

import { LaunchpadProvider } from "./context/LaunchpadContext.jsx";
import { PortfolioProvider } from "./context/PortfolioContext.jsx";

const tempoMainnet = {
  id: 4217,
  name: "Tempo Mainnet",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.tempo.xyz"] } },
  blockExplorers: { default: { name: "Tempo Explorer", url: "https://explore.tempo.xyz" } },
};

const config = getDefaultConfig({
  appName: "Tempo NFTs",
  projectId: "YOUR_REOWN_PROJECT_ID",
  chains: [tempoMainnet],
  transports: { [tempoMainnet.id]: http() },
});

const queryClient = new QueryClient();

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <BrowserRouter>
            <LaunchpadProvider>
              <PortfolioProvider>
                <Layout>
                  <Routes>
                    {/* Marketplace */}
                    <Route path="/"                              element={<Market />} />
                    <Route path="/collection/:id"               element={<CollectionPage />} />
                    <Route path="/collection/:id/:tokenId"      element={<NFTItemPage />} />
                    <Route path="/nft/:tokenId"                 element={<NFTItemPage />} />

                    {/* Launchpad */}
                    <Route path="/launchpad"                    element={<LaunchpadPage />} />
                    <Route path="/launchpad/:slug"              element={<MintPage />} />

                    {/* Creator Studio */}
                    <Route path="/studio"                       element={<StudioPage />} />
                    <Route path="/studio/manage/:contractAddress" element={<CollectionManagerPage />} />

                    {/* User */}
                    <Route path="/portfolio"                    element={<PortfolioPage />} />

                    {/* Admin */}
                    <Route path="/application"                  element={<ApplicationPage />} />
                    <Route path="/admin"                        element={<AdminPage />} />
                  </Routes>
                </Layout>
              </PortfolioProvider>
            </LaunchpadProvider>
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
