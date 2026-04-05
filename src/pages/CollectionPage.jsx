import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Grid, List } from "lucide-react";
import { useCollection } from "@/hooks/useCollections.js";
import { useListings } from "@/hooks/useListings.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import CollectionBids from "@/components/CollectionBids.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import TraitFilter from "@/components/TraitFilter.jsx";
import Skeleton, { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import NFTImage from "@/components/NFTImage.jsx";

const TABS = ["Items", "Activity", "Bids", "Analytics"];

const DEMO_PRICE_DATA = [
  { date: "Mar 30", price: 0.24 },
  { date: "Mar 31", price: 0.26 },
  { date: "Apr 1",  price: 0.22 },
  { date: "Apr 2",  price: 0.28 },
  { date: "Apr 3",  price: 0.31 },
  { date: "Apr 4",  price: 0.27 },
  { date: "Apr 5",  price: 0.30 },
];

const DEMO_TRAITS = {
  Background: [{ value: "Cyber Blue", count: 342 }, { value: "Neon Green", count: 211 }],
  Fur:        [{ value: "Gold", count: 88 }, { value: "White", count: 445 }],
  Eyes:       [{ value: "Laser", count: 120 }, { value: "Alien", count: 56 }],
};

export default function CollectionPage() {
  const { id } = useParams();
  const { collection, loading } = useCollection(id);
  const { listings, loading: listLoading } = useListings({ collectionId: id });
  const [tab, setTab] = useState("Items");
  const [view, setView] = useState("grid");
  const [traitFilter, setTraitFilter] = useState({});
  const [listModal, setListModal] = useState(null);

  const col = collection ?? {
    name: "TempoFelines",
    verified: true,
    gradient: "linear-gradient(135deg,#0d2137,#071424)",
    supply: 5000,
    floor: "0.2800",
    topOffer: "0.2600",
    volume: 142.5,
    change24h: 8.4,
  };

  const items = listings.length ? listings : Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1),
    name: `${col.name} #${(i + 1).toString().padStart(4, "0")}`,
    price: (0.25 + i * 0.01).toFixed(4),
    gradient: col.gradient,
  }));

  return (
    <div className="fade-up">
      {/* Banner */}
      <div
        className="relative h-44 w-full overflow-hidden"
        style={{ background: col.gradient ?? "linear-gradient(135deg,#0d2137,#071424)" }}
      >
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, #0b0f14)" }} />
      </div>

      <div className="px-6 max-w-6xl mx-auto">
        {/* Collection meta */}
        <div className="flex items-end gap-5 -mt-10 mb-8 relative z-10">
          <div className="w-20 h-20 rounded-2xl flex-shrink-0 overflow-hidden ring-4" style={{ background: col.gradient, ringColor: "#0b0f14" }}>
            <NFTImage src={col.image} alt={col.name} gradient={col.gradient} style={{ width: "100%", height: "100%" }} />
          </div>
          <div className="pb-1">
            {loading ? <Skeleton style={{ width: 180, height: 22 }} /> : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold" style={{ color: "#e6edf3" }}>{col.name}</h1>
                {col.verified && <CheckCircle2 size={16} color="#22d3ee" />}
              </div>
            )}
            <p className="text-sm mt-0.5" style={{ color: "#9da7b3" }}>{(col.supply ?? 0).toLocaleString()} items</p>
          </div>

          {/* Stats */}
          <div className="ml-auto hidden md:flex items-center gap-6">
            {[
              { label: "Floor", value: `${col.floor} ETH` },
              { label: "Top Offer", value: `${col.topOffer} ETH` },
              { label: "Volume", value: `${col.volume} ETH` },
              { label: "24h", value: `${col.change24h > 0 ? "+" : ""}${col.change24h}%`, color: col.change24h >= 0 ? "#22c55e" : "#ef4444" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-right">
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>{label}</p>
                <p className="font-mono text-sm font-bold" style={{ color: color ?? "#e6edf3" }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="h-10 px-4 text-sm font-semibold transition-colors -mb-px"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: tab === t ? "#22d3ee" : "#9da7b3",
                borderBottom: tab === t ? "2px solid #22d3ee" : "2px solid transparent",
                fontFamily: "Syne, sans-serif",
              }}
            >
              {t}
            </button>
          ))}
          {tab === "Items" && (
            <div className="ml-auto flex items-center gap-1.5">
              {[{ v: "grid", Icon: Grid }, { v: "list", Icon: List }].map(({ v, Icon }) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: view === v ? "rgba(34,211,238,0.12)" : "#161d28", border: "none", cursor: "pointer", color: view === v ? "#22d3ee" : "#9da7b3" }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-6 pb-12">
          {/* Trait filter sidebar */}
          {tab === "Items" && (
            <div className="hidden lg:block w-56 flex-shrink-0">
              <TraitFilter traits={DEMO_TRAITS} selected={traitFilter} onChange={setTraitFilter} />
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {tab === "Items" && (
              <div className={view === "grid" ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col gap-2"}>
                {listLoading
                  ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
                  : items.map((item) => (
                      <div
                        key={item.id}
                        className="card-hover rounded-2xl overflow-hidden cursor-pointer"
                        style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
                        onClick={() => setListModal(item)}
                      >
                        <div className="aspect-square" style={{ background: item.gradient ?? col.gradient }}>
                          <NFTImage src={item.image} alt={item.name} gradient={item.gradient ?? col.gradient} style={{ width: "100%", height: "100%" }} />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{item.name}</p>
                          <p className="font-mono text-sm mt-1" style={{ color: "#22d3ee" }}>{item.price} ETH</p>
                        </div>
                      </div>
                    ))}
              </div>
            )}
            {tab === "Activity" && <ActivityFeed collectionId={id} />}
            {tab === "Bids" && <CollectionBids collectionId={id} />}
            {tab === "Analytics" && (
              <div className="rounded-2xl p-6" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 className="text-sm font-bold mb-4" style={{ color: "#9da7b3" }}>Floor Price History</h3>
                <PriceChart data={DEMO_PRICE_DATA} />
              </div>
            )}
          </div>
        </div>
      </div>

      {listModal && <ListModal nft={listModal} onClose={() => setListModal(null)} />}
    </div>
  );
}
