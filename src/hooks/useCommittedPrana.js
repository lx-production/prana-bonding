import { useReadContract } from 'wagmi';
import { BUY_BOND_ADDRESS, BUY_BOND_ABI } from '../constants/buyBondContract';
import { PRANA_DECIMALS } from '../constants/sharedContracts';
import { formatUnits } from 'viem';

export const useCommittedPrana = ({
  contractAddress = BUY_BOND_ADDRESS,
  contractAbi = BUY_BOND_ABI,
} = {}) => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'committedPrana',
  });

  const formattedData = data ? formatUnits(data, PRANA_DECIMALS) : '0';

  return {
    committedPrana: formattedData,
    committedPranaRaw: data ?? 0n,
    isLoading,
    error,
    refetch,
  };
};