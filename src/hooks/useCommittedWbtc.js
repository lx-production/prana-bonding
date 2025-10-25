import { useReadContract } from 'wagmi';
import { SELL_BOND_ADDRESS, SELL_BOND_ABI } from '../constants/sellBondContract';
import { WBTC_DECIMALS } from '../constants/sharedContracts';
import { formatUnits } from 'viem';
import { formatUnits } from 'viem';

export const useCommittedWbtc = ({
  contractAddress = SELL_BOND_ADDRESS,
  contractAbi = SELL_BOND_ABI,
} = {}) => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'committedWbtc',
  });

  const formattedData = data ? formatUnits(data, WBTC_DECIMALS) : '0';

  return {
    committedWbtc: formattedData,
    committedWbtcRaw: data ?? 0n,
    isLoading,
    error,
    refetch,
  };
};