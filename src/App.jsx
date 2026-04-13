import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider, http } from "wagmi";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

// Components & Pages
import Layout from "./components/Layout.jsx";
import Market from "./pages/Market.jsx";
import CollectionPage from "./pages/CollectionPage.jsx";
import LaunchpadPage from "./pages/LaunchpadPage.jsx";
import MintPage from "./pages/MintPage.jsx";
import NFTItemPage from "./pages/NFTItemPage.jsx";
import PortfolioPage from "./pages/PortfolioPage.jsx";
import ApplicationPage from "./pages/ApplicationPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";

// Context
import { LaunchpadProvider } from "./context/LaunchpadContext.jsx";
import { PortfolioProvider } from "./context/PortfolioContext.jsx";

// 1. Define Tempo Mainnet Configuration
const tempoMainnet = {
  id: 4217,
  name: "Tempo Mainnet",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.tempo.xyz"] },
  },
  blockExplorers: {
    default: { name: "Tempo Explorer", url: "https://explore.tempo.xyz" },
  },
};

// 2. Setup Wagmi Config
const config = getDefaultConfig({
  appName: "Tempo NFTs",
  projectId: "YOUR_REOWN_PROJECT_ID", // Get one at cloud.reown.com
  chains: [tempoMainnet],
  transports: {
    [tempoMainnet.id]: http(),
  },
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
                    <Route path="/" element={<Market />} />
<Route path="/collection/:id/:tokenId" element={<NFTItemPage />} />
                    <Route path="/collection/:id" element={<CollectionPage />} />
                    <Route path="/nft/:tokenId" element={<NFTItemPage />} />
                    <Route path="/launchpad" element={<LaunchpadPage />} />
                    <Route path="/launchpad/:slug" element={<MintPage />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                    <Route path="/applocation" element={<ApplicationPage />} />
                    <Route path="/admin" element={<AdminPage />} />
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
