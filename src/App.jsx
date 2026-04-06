import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Market from "./pages/Market.jsx";
import CollectionPage from "./pages/CollectionPage.jsx";
import LaunchpadPage from "./pages/LaunchpadPage.jsx";
import MintPage from "./pages/MintPage.jsx"; // New Detail Page
import PortfolioPage from "./pages/PortfolioPage.jsx";
import History from "./pages/History.jsx";
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
              <Route path="/" element={<Market />} />
              
              {/* Marketplace Routes */}
              <Route path="/collection/:id" element={<CollectionPage />} />
              <Route path="/history" element={<History />} />
              
              {/* Launchpad Routes */}
              <Route path="/launchpad" element={<LaunchpadPage />} />
              <Route path="/launchpad/:slug" element={<MintPage />} /> {/* Dynamic Mint Route */}
              
              {/* User & Admin Routes */}
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
