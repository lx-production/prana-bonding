import React from 'react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';

const ConnectWallet = () => {
  const { connect, connectors, isLoading, error } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // Find the injected connector (MetaMask)
  const injectedConnector = connectors.find(c => c.id === 'injected');

  if (isConnected) {
    return (
      <div className="wallet-container">
        <span className="address">{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
        <button 
          className="btn-disconnect"
          onClick={() => disconnect()}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      className="btn-primary"
      onClick={() => connect({ connector: injectedConnector })}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <span className="loading"></span>
          Connecting...
        </>
      ) : (
        'Connect Wallet'
      )}
    </button>
  );
};

export default ConnectWallet; 