# TEMPONYAN — NFT Marketplace + Launchpad

A production-ready NFT marketplace and launchpad built with React + Vite. Clean architecture, ready to push to GitHub and deploy on Vercel.

## Tech Stack

- **React 18** + **Vite 6**
- **TypeScript**
- **TailwindCSS v4**
- **React Router v6**
- **Zustand** — wallet state management
- **Ethers.js v6** — wallet connection (MetaMask / EIP-1193)

## Project Structure

```
src/
├── app/
│   └── App.tsx                  # Root router
├── main.tsx                     # Entry point
├── styles/
│   └── globals.css              # TailwindCSS + global design tokens
├── constants/
│   └── index.ts                 # App-wide constants
├── utils/
│   └── index.ts                 # formatEth, shortenAddress, cn…
├── store/
│   └── useWalletStore.ts        # Zustand wallet store
├── hooks/
│   ├── useWallet.ts
│   ├── useCollections.ts
│   ├── useNFT.ts
│   └── useCountdown.ts
├── services/
│   └── marketplace.ts           # Async service stubs → swap for real API
├── features/
│   ├── marketplace/             # Types + mock data
│   ├── launchpad/
│   └── wallet/
├── components/
│   ├── ui/
│   │   └── Button.tsx
│   ├── layout/
│   │   └── Header.tsx           # Sticky header: logo, search, wallet
│   └── shared/
│       ├── LiveMintCard.tsx     # Countdown mint card
│       └── CollectionTable.tsx  # Collections rankings table
└── pages/
    ├── Home/                    # Live mints + collections table
    ├── Collection/              # Banner + NFT grid
    ├── NFT/                     # Detail: image, price, buy/bid
    └── NotFound/
```

## Routes

| Path | Page |
|---|---|
| `/` | Homepage — live mints strip + collections table |
| `/collection/:id` | Collection — banner, stats, NFT grid |
| `/nft/:id` | NFT Detail — image, price, Buy Now + Place Bid |

## Getting Started

```bash
npm install     # or pnpm install / yarn install
npm run dev     # starts dev server at http://localhost:5173
npm run build   # type-check + production build → dist/
npm run preview # preview the production build
```

## Deploy to Vercel

1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com)
3. Framework preset: **Vite** (auto-detected)
4. Build command: `npm run build`
5. Output directory: `dist`

## Extending with Real Data

All data fetching is centralised in `src/services/marketplace.ts`. Swap the mock functions for real API or contract calls. Wallet interaction is ready to use — just extend `src/store/useWalletStore.ts`.
