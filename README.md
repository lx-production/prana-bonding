# PRANA Bonding - OTC Trade with THĐP

A decentralized bonding platform for the PRANA Protocol, allowing users to buy and sell PRANA bonds directly with PRANA Protocol from THĐP.

## Features

- Wallet Connection: Seamless integration with Web3 wallets
- Bond Purchase Functionality (Buy Bonds with WBTC)
- Bond Selling Functionality (Sell Bonds for WBTC)
- Bond Market Information (Pricing, Vesting terms and interest)
- Active Bonds Management (Claiming vested tokens)
- Real-time Contract Information
- Bilingual Support (English/Vietnamese)

## Tech Stack

- React 19
- Vite
- wagmi (Ethereum interactions)
- Material-UI (MUI)
- TanStack Query (React Query)
- viem (Ethereum Library)

## Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn
- A Web3 wallet (e.g., MetaMask)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd prana-bonding
```

2. Install dependencies:
```bash
npm install
```

3. Create environment variables:
```bash
cp .env.example .env
```
Then edit `.env` with your configuration.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Development

The project is structured as follows:
