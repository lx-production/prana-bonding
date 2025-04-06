import { useReadContract } from 'wagmi';
import { BUY_BOND_ADDRESS, BUY_BOND_ABI } from '../constants/buyBondContract';
import { PRANA_DECIMALS } from '../constants/sharedContracts';
import { formatUnits } from 'viem';

export const useCommittedPrana = () => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: BUY_BOND_ADDRESS,
    abi: BUY_BOND_ABI,
    functionName: 'committedPrana',
  });

  // Format the raw BigInt value
  const formattedData = data ? formatUnits(data, PRANA_DECIMALS) : '0';

  return { committedPrana: formattedData, isLoading, error, refetch };
};