import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { SELL_BOND_ADDRESS_V1, SELL_BOND_ADDRESS_V2, SELL_BOND_ABI_V1, SELL_BOND_ABI_V2 } from '../constants/sellBondContract';
import { SELL_BOND_BONDS_ABI } from '../constants/bondVolumeFragments';
import { WBTC_ADDRESS, WBTC_ABI, WBTC_DECIMALS, PRANA_DECIMALS } from '../constants/sharedContracts'; // Use PRANA token details for balance check
import { useCommittedWbtc } from '../hooks/useCommittedWbtc'; // Import the new hook
import { useTotalBondPranaVolume } from '../hooks/useTotalBondPranaVolume';

const SELL_BOND_V1_TOTAL_VOLUME_RAW = parseUnits('194235', PRANA_DECIMALS);

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
  const { committedWbtcRaw: committedWbtcRawV2, isLoading: isLoadingCommittedV2, error: committedErrorV2 } = useCommittedWbtc({
    contractAddress: SELL_BOND_ADDRESS_V2,
    contractAbi: SELL_BOND_ABI_V2,
  });

  const { committedWbtcRaw: committedWbtcRawV1, isLoading: isLoadingCommittedV1, error: committedErrorV1 } = useCommittedWbtc({
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

  const bondContracts = useMemo(
    () => [
      { address: SELL_BOND_ADDRESS_V2, abi: SELL_BOND_ABI_V2, bondAbi: SELL_BOND_BONDS_ABI },
    ],
    []
  );

  const {
    totalPranaRaw: totalBondVolumeRawV2,
    isLoading: isLoadingVolume,
    error: bondVolumeError,
  } = useTotalBondPranaVolume({
    contracts: bondContracts,
    fieldName: 'pranaAmount',
    decimals: PRANA_DECIMALS,
  });

  const isLoading = isLoadingBalanceV1 || isLoadingBalanceV2 || isLoadingCommittedV1 || isLoadingCommittedV2 || isLoadingVolume;
  const error = balanceErrorV1 || balanceErrorV2 || committedErrorV1 || committedErrorV2 || bondVolumeError;

  const totalBalance = (balanceV1 || 0n) + (balanceV2 || 0n);
  const totalCommittedRaw = (committedWbtcRawV1 || 0n) + (committedWbtcRawV2 || 0n);
  const totalCommitted = formatUnits(totalCommittedRaw, WBTC_DECIMALS);
  const formattedBalance = formatUnits(totalBalance, WBTC_DECIMALS);
  const totalBondVolumeRaw = (totalBondVolumeRawV2 || 0n) + SELL_BOND_V1_TOTAL_VOLUME_RAW;
  const totalBondVolume = formatUnits(totalBondVolumeRaw, PRANA_DECIMALS);

  return (
    <div className="balance-container">
      <h3>Sell Bond Status</h3>
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
          <p>
            Total Volume (V1 + V2): <span className="balance">{totalBondVolume}</span> <span className="token-symbol">PRANA</span>
          </p>
        </>
      )}
    </div>
  );
};

export default SellBondBalance;