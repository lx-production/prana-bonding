import { toBigInt, extractResult } from './bigint-utils';
import { SELL_BOND_ADDRESS, SELL_BOND_ABI } from '../constants/sellBondContract';
import { WBTC_ADDRESS, WBTC_ABI } from '../constants/sharedContracts';

export const fetchImpactedReserves = async (publicClient) => {
  const [wbtcRes, pranaRes, lastSync] = await publicClient.multicall({
    contracts: [
      {
        address: SELL_BOND_ADDRESS,
        abi: SELL_BOND_ABI,
        functionName: 'impactedWbtcReserve',
      },
      {
        address: SELL_BOND_ADDRESS,
        abi: SELL_BOND_ABI,
        functionName: 'impactedPranaReserve',
      },
      {
        address: SELL_BOND_ADDRESS,
        abi: SELL_BOND_ABI,
        functionName: 'lastImpactedSync',
      },
    ],
    allowFailure: false,
  });

  return {
    impactedWbtcReserve: toBigInt(extractResult(wbtcRes)),
    impactedPranaReserve: toBigInt(extractResult(pranaRes)),
    lastImpactedSync: toBigInt(extractResult(lastSync)),
  };
};

export const fetchContractWbtcBalance = async (publicClient) => {
  const [wbtcBalance, committedWbtc] = await publicClient.multicall({
    contracts: [
      {
        address: WBTC_ADDRESS,
        abi: WBTC_ABI,
        functionName: 'balanceOf',
        args: [SELL_BOND_ADDRESS],
      },
      {
        address: SELL_BOND_ADDRESS,
        abi: SELL_BOND_ABI,
        functionName: 'committedWbtc',
      },
    ],
    allowFailure: false,
  });

  const contractWbtcBalance = toBigInt(extractResult(wbtcBalance));
  const committedWbtcAmount = toBigInt(extractResult(committedWbtc));
  const availableWbtc = contractWbtcBalance - committedWbtcAmount;

  return {
    contractWbtcBalance,
    committedWbtc: committedWbtcAmount,
    availableWbtc: availableWbtc > 0n ? availableWbtc : 0n,
  };
};
