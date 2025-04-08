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

src/
├── assets/ # Static assets
├── components/ # React components
├── constants/ # Constants and configuration
├── context/ # React Context providers
├── hooks/ # Custom React hooks
├── utils/ # Utility functions
├── App.jsx # Main application component
└── main.jsx # Application entry point


## Smart Contracts

Smart contracts for buying and selling PRANA bonds can be found in the `contracts/` directory (e.g., `BuyPranaBond.sol`, `SellPranaBond.sol`). Make sure to deploy and configure the contract addresses in your environment variables.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Smart contracts Author: prana@triethocduongpho
MIT license.

## Contact

PRANA Protocol - [thdp@triethocduongpho.net]

---

PRANA Protocol