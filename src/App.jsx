import React from 'react';
import { useAccount } from 'wagmi';
import ConnectWallet from './components/ConnectWallet';
import ThemeSwitcher from './components/ThemeSwitcher';
import BuyBondForm from './components/BuyBondForm';
import SellBondForm from './components/SellBondForm';
import ActiveBonds from './components/ActiveBonds';
import BuyBondBalance from './components/BuyBondBalance';
import SellBondBalance from './components/SellBondBalance';

function App() {
  const { isConnected } = useAccount();

  const handleTabChange = (tabName) => {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.bond-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.bond-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // Add active class to selected tab and content
    if (tabName === 'buy') {
      document.getElementById('buy-bond-tab').classList.add('active');
      document.getElementById('buy-bond-content').classList.add('active');
    } else if (tabName === 'sell') {
      document.getElementById('sell-bond-tab').classList.add('active');
      document.getElementById('sell-bond-content').classList.add('active');
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1 style={{ fontWeight: '800' }}>PRANA Bonding</h1>        
        <ConnectWallet />
      </header>
      
      <div className="theme-slogan-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="slogan">
          <h4>Engineered to outperform</h4>
        </div>
        <ThemeSwitcher />
      </div>  

      <main>        
        {isConnected ? (
          <div>
            <div className="balance-cards-container">
              <div className="card">
                <BuyBondBalance />
              </div>
              <div className="card">
                <SellBondBalance />
              </div>
            </div>            
            <div className="card bond-card-container">
              <div className="bond-tabs">
                <div className="bond-tab active" id="buy-bond-tab" onClick={() => handleTabChange('buy')}>
                  Mua PRANA với Discount
                </div>
                <div className="bond-tab" id="sell-bond-tab" onClick={() => handleTabChange('sell')}>
                  Bán PRANA với Premium
                </div>
              </div>
              
              <div className="bond-tab-content active" id="buy-bond-content">
                <BuyBondForm />
              </div>
              
              <div className="bond-tab-content" id="sell-bond-content">
                <SellBondForm />
              </div>
            </div>
            <div className="card">
              <ActiveBonds />
            </div>
          </div>
        ) : (
          <div className="card">
            <h2>Welcome to PRANA Bonding - OTC Trading</h2>
            <p>Connect your wallet to get started. Kết nối Ví của bạn để bắt đầu.</p>
          </div>
        )}
      </main>   
      
      <footer className="footer">
        <p>©2025 PRANA Protocol</p>
        <a
          href="https://polygonscan.com/address/0xA3adf8952982Eac60C0E43d6F93C66E7363c6Fe2"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          Buy Bond Contract
        </a>
        <a
          href="https://polygonscan.com/address/0x2A48215e134a9382e1eBAf96F2Fa47Ca1c2fa092"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          Sell Bond Contract
        </a>      
        <div className="footer-links">          
          <a 
            href="https://github.com/lx-production/prana-bonding"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-github"
          >
            <svg
              height="20"
              width="20"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App; 