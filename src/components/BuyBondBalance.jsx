import React from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { BUY_BOND_ADDRESS } from '../constants/buyBondContract'; // Use the Bond contract address
import { PRANA_ADDRESS, PRANA_ABI, PRANA_DECIMALS } from '../constants/sharedContracts'; // Use PRANA token details for balance check
import { useCommittedPrana } from '../hooks/useCommittedPrana'; // Import the new hook

const BuyBondBalance = () => {
  // Fetch the balance of PRANA tokens held by the BUY_BOND_ADDRESS
  const { data: balance, isLoading: isLoadingBalance, error: balanceError } = useReadContract({
    address: PRANA_ADDRESS, // Check balance on the PRANA token contract
    abi: PRANA_ABI,
    functionName: 'balanceOf',
    args: [BUY_BOND_ADDRESS],
  });

  // Fetch the committed PRANA value using the new hook
  const { committedPrana, isLoading: isLoadingCommitted, error: committedError } = useCommittedPrana();

  // Log any errors for debugging
  if (balanceError) {
    console.error("Contract Balance error:", balanceError);
  }
  if (committedError) {
    console.error("Committed Prana error:", committedError);
  }

  const isLoading = isLoadingBalance || isLoadingCommitted;
  const error = balanceError || committedError;

  return (
    <div className="balance-container">
      <h3>Buy Bond Contract Status</h3>
      {isLoading ? (
        <p>Loading details...</p>
      ) : error ? (
        <p className="error">Error loading contract details: {error.message || 'Unknown error'}</p>
      ) : (
        <>
          <p>
            Balance: <span className="balance">{balance ? formatUnits(balance, PRANA_DECIMALS) : '0'}</span> <span className="token-symbol">PRANA</span>
          </p>
          <p>
            Committed: <span className="balance">{committedPrana}</span> <span className="token-symbol">PRANA</span>
          </p>
        </>
      )}
    </div>
  );
};

export default BuyBondBalance;