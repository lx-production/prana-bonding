import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { BUY_BOND_ADDRESS_V1, BUY_BOND_ADDRESS_V2, BUY_BOND_ABI_V1, BUY_BOND_ABI_V2 } from '../constants/buyBondContract';
import { BUY_BOND_BONDS_ABI } from '../constants/bondVolumeFragments';
import { PRANA_ADDRESS, PRANA_ABI, PRANA_DECIMALS } from '../constants/sharedContracts'; // Use PRANA token details for balance check
import { useCommittedPrana } from '../hooks/useCommittedPrana';
import { useTotalBondPranaVolume } from '../hooks/useTotalBondPranaVolume';

const BuyBondBalance = () => {
  // Fetch the balance of PRANA tokens held by the BUY_BOND_ADDRESS
  const { data: balanceV1, isLoading: isLoadingBalanceV1, error: balanceErrorV1 } = useReadContract({
    address: PRANA_ADDRESS,
    abi: PRANA_ABI,
    functionName: 'balanceOf',
    args: [BUY_BOND_ADDRESS_V1],
  });

  const { data: balanceV2, isLoading: isLoadingBalanceV2, error: balanceErrorV2 } = useReadContract({
    address: PRANA_ADDRESS,
    abi: PRANA_ABI,
    functionName: 'balanceOf',
    args: [BUY_BOND_ADDRESS_V2],
  });

  // Fetch the committed PRANA value using the new hook
  const { committedPranaRaw: committedPranaRawV2, isLoading: isLoadingCommittedV2, error: committedErrorV2 } = useCommittedPrana({
    contractAddress: BUY_BOND_ADDRESS_V2,
    contractAbi: BUY_BOND_ABI_V2,
  });

  const { committedPranaRaw: committedPranaRawV1, isLoading: isLoadingCommittedV1, error: committedErrorV1 } = useCommittedPrana({
    contractAddress: BUY_BOND_ADDRESS_V1,
    contractAbi: BUY_BOND_ABI_V1,
  });

  // Log any errors for debugging
  if (balanceErrorV1) {
    console.error("Contract Balance V1 error:", balanceErrorV1);
  }
  if (balanceErrorV2) {
    console.error("Contract Balance V2 error:", balanceErrorV2);
  }
  if (committedErrorV1) {
    console.error("Committed Prana V1 error:", committedErrorV1);
  }
  if (committedErrorV2) {
    console.error("Committed Prana V2 error:", committedErrorV2);
  }

  const {
    totalPranaFormatted: totalBondVolume,
    isLoading: isLoadingVolume,
    error: bondVolumeError,
  } = useTotalBondPranaVolume({
    contracts: [
      { address: BUY_BOND_ADDRESS_V1, abi: BUY_BOND_ABI_V1, bondAbi: BUY_BOND_BONDS_ABI },
      { address: BUY_BOND_ADDRESS_V2, abi: BUY_BOND_ABI_V2, bondAbi: BUY_BOND_BONDS_ABI },
    ],
    fieldName: 'pranaAmount',
    decimals: PRANA_DECIMALS,
  });

  const isLoading = isLoadingBalanceV1 || isLoadingBalanceV2 || isLoadingCommittedV1 || isLoadingCommittedV2 || isLoadingVolume;
  const error = balanceErrorV1 || balanceErrorV2 || committedErrorV1 || committedErrorV2 || bondVolumeError;

  const totalBalance = (balanceV1 || 0n) + (balanceV2 || 0n);
  const formattedBalance = formatUnits(totalBalance, PRANA_DECIMALS);
  const totalCommittedRaw = (committedPranaRawV1 || 0n) + (committedPranaRawV2 || 0n);
  const totalCommitted = formatUnits(totalCommittedRaw, PRANA_DECIMALS);

  return (
    <div className="balance-container">
      <h3>Buy Bond Status</h3>
      {isLoading ? (
        <p>Loading details...</p>
      ) : error ? (
        <p className="error">Error loading contract details: {error.message || 'Unknown error'}</p>
      ) : (
        <>
          <p>
            Balance: <span className="balance">{formattedBalance}</span> <span className="token-symbol">PRANA</span>
          </p>
          <p>
            Committed: <span className="balance">{totalCommitted}</span> <span className="token-symbol">PRANA</span>
          </p>
          <p>
            Total Buy Bond Volume: <span className="balance">{totalBondVolume}</span> <span className="token-symbol">PRANA</span>
          </p>
        </>
      )}
    </div>
  );
};

export default BuyBondBalance;