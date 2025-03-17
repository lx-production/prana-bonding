import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig, WagmiProvider } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { http } from 'viem'
import { ThemeProvider } from './context/ThemeContext'
import { startSpinningFavicon } from './spinningFavicon'

// Create a client for React Query
const queryClient = new QueryClient()

// Get Alchemy URL from environment variable
const alchemyUrl = import.meta.env.VITE_ALCHEMY_POLYGON_MAIN

if (!alchemyUrl) {
  throw new Error('Missing VITE_ALCHEMY_POLYGON_MAIN environment variable')
}

// Configure wagmi
const config = createConfig({
  chains: [polygon],
  connectors: [injected()],
  transports: {
    [polygon.id]: http(alchemyUrl)
  }
})

// Start the spinning favicon animation
startSpinningFavicon();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
) 