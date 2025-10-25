import React from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import {
  SELL_BOND_ADDRESS_V1,
  SELL_BOND_ADDRESS_V2,
  SELL_BOND_ABI_V1,
  SELL_BOND_ABI_V2,
} from '../constants/sellBondContract';
import { WBTC_ADDRESS, WBTC_ABI, WBTC_DECIMALS } from '../constants/sharedContracts'; // Use PRANA token details for balance check
import { useCommittedWbtc } from '../hooks/useCommittedWbtc'; // Import the new hook

const SellBondBalance = () => {
  // Fetch the balance of PRANA tokens held by the BUY_BOND_ADDRESS
  const { data: balanceV1, isLoading: isLoadingBalanceV1, error: balanceErrorV1 } = useReadContract({
    address: WBTC_ADDRESS,
    abi: WBTC_ABI,
    functionName: 'balanceOf',
    args: [SELL_BOND_ADDRESS_V1],
  });

  const { data: balanceV2, isLoading: isLoadingBalanceV2, error: balanceErrorV2 } = useReadContract({
    address: WBTC_ADDRESS,
    abi: WBTC_ABI,
    functionName: 'balanceOf',
    args: [SELL_BOND_ADDRESS_V2],
  });

  // Fetch the committed PRANA value using the new hook
  const { committedWbtc: committedWbtcV2, committedWbtcRaw: committedWbtcRawV2, isLoading: isLoadingCommittedV2, error: committedErrorV2 } = useCommittedWbtc({
    contractAddress: SELL_BOND_ADDRESS_V2,
    contractAbi: SELL_BOND_ABI_V2,
  });

  const { committedWbtc: committedWbtcV1, committedWbtcRaw: committedWbtcRawV1, isLoading: isLoadingCommittedV1, error: committedErrorV1 } = useCommittedWbtc({
    contractAddress: SELL_BOND_ADDRESS_V1,
    contractAbi: SELL_BOND_ABI_V1,
  });

  // Log any errors for debugging
  if (balanceErrorV1) {
    console.error("Contract Balance V1 error:", balanceErrorV1);
  }
  if (balanceErrorV2) {
    console.error("Contract Balance V2 error:", balanceErrorV2);
  }
  if (committedErrorV1) {
    console.error("Committed Wbtc V1 error:", committedErrorV1);
  }
  if (committedErrorV2) {
    console.error("Committed Wbtc V2 error:", committedErrorV2);
  }

  const isLoading = isLoadingBalanceV1 || isLoadingBalanceV2 || isLoadingCommittedV1 || isLoadingCommittedV2;
  const error = balanceErrorV1 || balanceErrorV2 || committedErrorV1 || committedErrorV2;

  const totalBalance = (balanceV1 || 0n) + (balanceV2 || 0n);
  const totalCommittedRaw = (committedWbtcRawV1 || 0n) + (committedWbtcRawV2 || 0n);
  const totalCommitted = formatUnits(totalCommittedRaw, WBTC_DECIMALS);
  const formattedBalance = formatUnits(totalBalance, WBTC_DECIMALS);

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
            Balance: <span className="balance">{formattedBalance}</span> <span className="token-symbol">WBTC</span>
          </p>
          <p>
            Committed: <span className="balance">{totalCommitted}</span> <span className="token-symbol">WBTC</span>
          </p>
        </>
      )}
    </div>
  );
};

export default SellBondBalance;