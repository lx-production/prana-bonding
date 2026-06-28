import { useConnect, useConnectors, useConnection, useDisconnect } from 'wagmi';

const ConnectWallet = () => {
  const { mutate: connect, isPending: isConnecting } = useConnect();
  const connectors = useConnectors();
  const { address, isConnected } = useConnection();
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnect();

  // Prefer an injected wallet if usable, otherwise fall back to the first available connector.
  const readyConnectors =
    connectors?.filter(connector => connector && connector.ready !== false) ?? [];
  const preferredConnector =
    readyConnectors.find(connector => connector.id === 'injected') ?? readyConnectors[0];
  const canConnect = Boolean(preferredConnector);

  if (isConnected) {
    return (
      <div className="wallet-container">
        <span className="address">{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
        <button 
          className="btn-disconnect"
          onClick={() => disconnect()}
          disabled={isDisconnecting}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-container">
      <button
        className="btn-primary"
        onClick={() => preferredConnector && connect({ connector: preferredConnector })}
        disabled={isConnecting || !canConnect}
      >
        {isConnecting ? (
          <>
            <span className="loading"></span>
            Connecting...
          </>
        ) : canConnect ? (
          'Connect Wallet'
        ) : (
          'No Wallet Detected'
        )}
      </button>
      {!canConnect && (
        <p className="wallet-helper-text">
          Install a compatible wallet (e.g. MetaMask) or use a WalletConnect-enabled app.
        </p>
      )}
    </div>
  );
};

export default ConnectWallet; 
