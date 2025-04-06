import React from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { SELL_BOND_ADDRESS } from '../constants/sellBondContract'; // Use the Bond contract address
import { WBTC_ADDRESS, WBTC_ABI, WBTC_DECIMALS } from '../constants/sharedContracts'; // Use PRANA token details for balance check
import { useCommittedWbtc } from '../hooks/useCommittedWbtc'; // Import the new hook

const SellBondBalance = () => {
  // Fetch the balance of PRANA tokens held by the BUY_BOND_ADDRESS
  const { data: balance, isLoading: isLoadingBalance, error: balanceError } = useReadContract({
    address: WBTC_ADDRESS, // Check balance on the PRANA token contract
    abi: WBTC_ABI,
    functionName: 'balanceOf',
    args: [SELL_BOND_ADDRESS],
  });

  // Fetch the committed PRANA value using the new hook
  const { committedWbtc, isLoading: isLoadingCommitted, error: committedError } = useCommittedWbtc();

  // Log any errors for debugging
  if (balanceError) {
    console.error("Contract Balance error:", balanceError);
  }
  if (committedError) {
    console.error("Committed Wbtc error:", committedError);
  }

  const isLoading = isLoadingBalance || isLoadingCommitted;
  const error = balanceError || committedError;

  return (
    <div className="balance-container">
      <h3>Sell Bond Contract Status</h3>
      {isLoading ? (
        <p>Loading details...</p>
      ) : error ? (
        <p className="error">Error loading contract details: {error.message || 'Unknown error'}</p>
      ) : (
        <>
          <p>
            Balance: <span className="balance">{balance ? formatUnits(balance, WBTC_DECIMALS) : '0'}</span> <span className="token-symbol">WBTC</span>
          </p>
          <p>
            Committed: <span className="balance">{committedWbtc}</span> <span className="token-symbol">WBTC</span>
          </p>
        </>
      )}
    </div>
  );
};

export default SellBondBalance;