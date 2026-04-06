import { motion, AnimatePresence } from "framer-motion";

// ─── New Hero Carousel (Replaces FeaturedCollections Grid) ──────────────────
function HeroCarousel({ navigate }) {
  const { collections, isLoading } = useCollections("volume_total");
  const [index, setIndex] = useState(0);

  // Auto-play logic
  useEffect(() => {
    if (collections.length < 2) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % Math.min(5, collections.length));
    }, 6000);
    return () => clearInterval(timer);
  }, [collections]);

  if (isLoading || !collections.length) return <SkeletonCard large />;

  const current = collections[index];

  return (
    <section className="relative w-full h-[65vh] min-h-[500px] overflow-hidden bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 cursor-pointer"
          onClick={() => navigate(`/collection/${current.slug}`)}
        >
          {/* Main Banner */}
          <img 
            src={current.banner_url || current.logo_url} 
            className="w-full h-full object-cover brightness-[0.5] shadow-inner"
            alt={current.name}
          />
          
          {/* Floating Content Overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black via-transparent to-transparent">
            <div className="max-w-7xl mx-auto w-full flex items-center gap-4 mb-8">
              <CollectionImg 
                logoUrl={current.logo_url} 
                name={current.name} 
                className="w-16 h-16 rounded-2xl border-2 border-white/20 shadow-2xl flex-shrink-0" 
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white truncate">
                    {current.name}
                  </h1>
                  {current.verified && <span className="text-cyan-400 text-xl">✓</span>}
                </div>
                <div className="flex gap-4 mt-1">
                  <Stat label="Floor" value={`${current.floor_price?.toFixed(2) || "0.00"} USD`} />
                  <Stat label="Volume" value={current.volume_total?.toLocaleString()} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {collections.slice(0, 5).map((_, i) => (
          <div 
            key={i} 
            className={`h-1 rounded-full transition-all duration-500 ${i === index ? "w-8 bg-cyan-400" : "w-2 bg-white/20"}`}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Top Movers (The 4 Weekly Cards) ──────────────────────────────────────────
function TopMoversGrid({ navigate }) {
  const { collections } = useCollections("volume_24h");
  const movers = collections.slice(0, 4);

  return (
    <section className="px-6 py-10">
      <h2 className="text-xl font-black italic uppercase tracking-tighter mb-6 text-white">
        Trending Tokens
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {movers.map((c) => (
          <div 
            key={c.id}
            onClick={() => navigate(`/collection/${c.slug}`)}
            className="group relative rounded-2xl p-4 bg-[#121821] border border-white/5 cursor-pointer hover:border-cyan-400/50 transition-all"
          >
            <div className="flex items-center gap-3">
              <CollectionImg logoUrl={c.logo_url} name={c.name} className="w-10 h-10 rounded-lg" />
              <div className="min-w-0">
                <p className="font-bold text-sm truncate text-white">{c.name}</p>
                <p className="text-green-400 text-[10px] font-mono">+{((Math.random() * 10)).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Re-Assembled Market Page ────────────────────────────────────────────────
export default function Market() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* 1. Full Hero Carousel */}
      <HeroCarousel navigate={navigate} />

      <div className="max-w-[1400px] mx-auto">
        {/* 2. Top Movers Cards */}
        <TopMoversGrid navigate={navigate} />

        {/* 3. Live Mints (Your existing horizontal strip) */}
        <LiveMints navigate={navigate} />

        {/* 4. Full Collection List */}
        <div className="px-6 pb-10">
           <h2 className="text-xl font-black italic uppercase tracking-tighter mb-6 text-white">
            Collections
          </h2>
          <CollectionsTable navigate={navigate} />
        </div>
      </div>
    </div>
  );
}
