import React from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { PRANA_TOKEN_ADDRESS, PRANA_TOKEN_ABI } from '../constants/contracts';

const PranaBalance = () => {
  const { address, isConnected } = useAccount();
  
  // Log the address for debugging
  console.log("Connected address:", address);
  console.log("Token address:", PRANA_TOKEN_ADDRESS);
  
  const { data: balance, isLoading, error } = useReadContract({
    address: PRANA_TOKEN_ADDRESS,
    abi: PRANA_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address],
    enabled: isConnected && !!address,
  });

  // Log any errors for debugging
  if (error) {
    console.error("Balance error:", error);
  }

  // Hardcoded decimals value instead of fetching from blockchain
  const decimals = 9;

  if (!isConnected) return null;

  return (
    <div className="balance-container">
      <h3>My PRANA Balance</h3>
      {isLoading ? (
        <p>Loading balance...</p>
      ) : error ? (
        <p className="error">Error loading balance: {error.message || 'Unknown error'}</p>
      ) : (
        <p className="balance">
          {balance ? formatUnits(balance, decimals) : '0'} <span className="token-symbol">PRANA</span>
        </p>
      )}
    </div>
  );
};

export default PranaBalance; 