import { useReadContract } from 'wagmi';
import { SELL_BOND_ADDRESS, SELL_BOND_ABI } from '../constants/sellBondContract';
import { WBTC_DECIMALS } from '../constants/sharedContracts';
import { formatUnits } from 'viem';

export const useCommittedWbtc = () => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: SELL_BOND_ADDRESS,
    abi: SELL_BOND_ABI,
    functionName: 'committedWbtc',
  });

  // Format the raw BigInt value
  const formattedData = data ? formatUnits(data, WBTC_DECIMALS) : '0';

  return { committedWbtc: formattedData, isLoading, error, refetch };
};