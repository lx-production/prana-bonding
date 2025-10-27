import { FullMath } from './FullMath';
import { toBigInt, extractResult } from './bigint-utils';
import { BUY_BOND_ADDRESS, BUY_BOND_ABI } from '../constants/buyBondContract';
import { PRANA_ADDRESS, PRANA_ABI } from '../constants/sharedContracts';

export const IMPACTED_RESERVE_WARNING = 'Lượng PRANA muốn mua vượt quá impacted reserve.';
export const TREASURY_WARNING = 'PRANA trong Buy Bond contract không đủ để bán số lượng yêu cầu.';

export const fetchImpactedReserves = async (publicClient) => {
  const [wbtcRes, pranaRes, lastSync] = await publicClient.multicall({
    contracts: [
      {
        address: BUY_BOND_ADDRESS,
        abi: BUY_BOND_ABI,
        functionName: 'impactedWbtcReserve'
      },
      {
        address: BUY_BOND_ADDRESS,
        abi: BUY_BOND_ABI,
        functionName: 'impactedPranaReserve'
      },
      {
        address: BUY_BOND_ADDRESS,
        abi: BUY_BOND_ABI,
        functionName: 'lastImpactedSync'
      }
    ],
    allowFailure: false
  });

  return {
    impactedWbtcReserve: toBigInt(extractResult(wbtcRes)),
    impactedPranaReserve: toBigInt(extractResult(pranaRes)),
    lastImpactedSync: toBigInt(extractResult(lastSync))
  };
};

// Fee not included
export const computeRegularWbtcFromImpacted = (impactedWbtc, impactedPrana, pranaAmount) => {
  const impactedWbtcBig = toBigInt(impactedWbtc);
  const impactedPranaBig = toBigInt(impactedPrana);
  const pranaAmountBig = toBigInt(pranaAmount);

  const denominator = impactedPranaBig - pranaAmountBig;
  if (denominator <= 0n) {
    return null;
  }
  return FullMath.mulDiv(impactedWbtcBig, pranaAmountBig, denominator);
};

// 1% fee included
export const computeRegularPranaFromImpacted = (impactedWbtc, impactedPrana, wbtcAfterFee) => {
  const impactedWbtcBig = toBigInt(impactedWbtc);
  const impactedPranaBig = toBigInt(impactedPrana);
  const wbtcAfterFeeBig = toBigInt(wbtcAfterFee);

  return FullMath.mulDiv(impactedPranaBig, wbtcAfterFeeBig, impactedWbtcBig + wbtcAfterFeeBig);
};

// Fee not included
export const computeMarketWbtc = (poolWbtc, poolPrana, pranaAmount) => {
  const poolWbtcBig = toBigInt(poolWbtc);
  const poolPranaBig = toBigInt(poolPrana);
  const pranaAmountBig = toBigInt(pranaAmount);

  const denominator = poolPranaBig - pranaAmountBig;
  if (denominator <= 0n) {
    return null;
  }
  return FullMath.mulDiv(poolWbtcBig, pranaAmountBig, denominator);
};

// 1% fee included
export const computeMarketPrana = (poolWbtc, poolPrana, wbtcAfterFee) => {
  const poolWbtcBig = toBigInt(poolWbtc);
  const poolPranaBig = toBigInt(poolPrana);
  const wbtcAfterFeeBig = toBigInt(wbtcAfterFee);

  return FullMath.mulDiv(poolPranaBig, wbtcAfterFeeBig, poolWbtcBig + wbtcAfterFeeBig);
};

export const fetchAvailableTreasuryPrana = async (publicClient) => {
  const [committedPranaRes, treasuryBalanceRes] = await publicClient.multicall({
    contracts: [
      {
        address: BUY_BOND_ADDRESS,
        abi: BUY_BOND_ABI,
        functionName: 'committedPrana'
      },
      {
        address: PRANA_ADDRESS,
        abi: PRANA_ABI,
        functionName: 'balanceOf',
        args: [BUY_BOND_ADDRESS]
      }
    ],
    allowFailure: false
  });

  const committedPrana = toBigInt(extractResult(committedPranaRes));
  const treasuryBalance = toBigInt(extractResult(treasuryBalanceRes));
  const availablePrana = treasuryBalance - committedPrana;

  return availablePrana > 0n ? availablePrana : 0n;
};

