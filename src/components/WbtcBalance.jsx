import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { WBTC_ADDRESS, WBTC_ABI } from '../constants/sharedContracts';

const WbtcBalance = () => {
  const { address, isConnected } = useAccount();
  
  // Log the address for debugging
  console.log("Connected address:", address);
  console.log("Token address:", WBTC_ADDRESS);
  
  const { data: balance, isLoading, error } = useReadContract({
    address: WBTC_ADDRESS,
    abi: WBTC_ABI,
    functionName: 'balanceOf',
    args: [address],
    enabled: isConnected && !!address,
  });

  // Log any errors for debugging
  if (error) {
    console.error("Balance error:", error);
  }

  // Hardcoded decimals value instead of fetching from blockchain
  const decimals = 8;

  if (!isConnected) return null;

  return (
    <div className="balance-container">
      <h3>My WBTC Balance</h3>
      {isLoading ? (
        <p>Loading balance...</p>
      ) : error ? (
        <p className="error">Error loading balance: {error.message || 'Unknown error'}</p>
      ) : (
        <p className="balance">
          {balance ? formatUnits(balance, decimals) : '0'} <span className="token-symbol">WBTC</span>
        </p>
      )}
    </div>
  );
};

export default WbtcBalance; 