import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Market from "./pages/Market.jsx";
import CollectionPage from "./pages/CollectionPage.jsx";
import LaunchpadPage from "./pages/LaunchpadPage.jsx";
import MintPage from "./pages/MintPage.jsx";
import NFTItemPage from "./pages/NFTItemPage.jsx";
import PortfolioPage from "./pages/PortfolioPage.jsx";
import ManagePage from "./pages/ManagePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import { LaunchpadProvider } from "./context/LaunchpadContext.jsx";
import { PortfolioProvider } from "./context/PortfolioContext.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <LaunchpadProvider>
        <PortfolioProvider>
          <Layout>
            <Routes>
              {/* Secondary Market */}
              <Route path="/" element={<Market />} />
              <Route path="/collection/:id" element={<CollectionPage />} />
              <Route path="/nft/:tokenId" element={<NFTItemPage />} />

              {/* Primary Market (Launchpad) */}
              <Route path="/launchpad" element={<LaunchpadPage />} />
              <Route path="/launchpad/:slug" element={<MintPage />} />

              {/* User & Infrastructure */}
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/manage" element={<ManagePage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </Layout>
        </PortfolioProvider>
      </LaunchpadProvider>
    </BrowserRouter>
  );
}
