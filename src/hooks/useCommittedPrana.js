import { useReadContract } from 'wagmi';
import { BOND_ADDRESS, BOND_ABI } from '../constants/bondingContracts';
import { PRANA_DECIMALS } from '../constants/sharedContracts';
import { formatUnits } from 'viem';

export const useCommittedPrana = () => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: BOND_ADDRESS,
    abi: BOND_ABI,
    functionName: 'committedPrana',
  });

  // Format the raw BigInt value
  const formattedData = data ? formatUnits(data, PRANA_DECIMALS) : '0';

  return { committedPrana: formattedData, isLoading, error, refetch };
};