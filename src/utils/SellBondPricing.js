import { FullMath } from './FullMath';
import { toBigInt, ensurePositiveReserve } from './bigint-utils';
import { fetchPoolReserves } from './UniswapV3Helper';
import { SELL_BOND_ADDRESS, SELL_BOND_ABI } from '../constants/sellBondContract';
import { fetchContractWbtcBalance, fetchImpactedReserves } from './sell-bond-contract-utils';

const RESERVE_WARNING_MESSAGE = 'Lượng PRANA muốn bán vượt quá mức WBTC ngân quỹ có thể trả.';

const computeRegularWbtcFromImpacted = (impactedWbtc, impactedPrana, netPranaAmount) => {
  const impactedWbtcBig = toBigInt(impactedWbtc);
  const impactedPranaBig = toBigInt(impactedPrana);
  const netPranaBig = toBigInt(netPranaAmount);

  const denominator = impactedPranaBig + netPranaBig;
  if (denominator <= 0n) {
    return null;
  }

  return FullMath.mulDiv(impactedWbtcBig, netPranaBig, denominator);
};

const computeMarketWbtc = (poolWbtc, poolPrana, netPranaAmount) => {
  const poolWbtcBig = toBigInt(poolWbtc);
  const poolPranaBig = toBigInt(poolPrana);
  const netPranaBig = toBigInt(netPranaAmount);

  const denominator = poolPranaBig + netPranaBig;
  if (denominator <= 0n) {
    return null;
  }

  return FullMath.mulDiv(poolWbtcBig, netPranaBig, denominator);
};

export const calculateWbtcQuote = async ({ pranaAmountWei, period, publicClient }) => {
  if (!publicClient) {
    return { wbtcQuote: 0n, reservesSynced: false, warning: '' };
  }

  const pranaAmount = toBigInt(pranaAmountWei);
  if (pranaAmount <= 0n) {
    return { wbtcQuote: 0n, reservesSynced: false, warning: '' };
  }

  const netPranaAmount = FullMath.mulDiv(pranaAmount, 99n, 100n);
  if (netPranaAmount <= 0n) {
    return { wbtcQuote: 0n, reservesSynced: false, warning: '' };
  }

  // Check if contract has enough WBTC to pay out the calculated amount
  const { availableWbtc } = await fetchContractWbtcBalance(publicClient);

  const { impactedWbtcReserve, impactedPranaReserve } = await fetchImpactedReserves(publicClient);
  const impactedWbtcBig = toBigInt(impactedWbtcReserve);
  const impactedPranaBig = toBigInt(impactedPranaReserve);

  const impactedWbtcSafe = ensurePositiveReserve(impactedWbtcBig);
  const impactedPranaSafe = ensurePositiveReserve(impactedPranaBig);

  let regularBaseline = computeRegularWbtcFromImpacted(
    impactedWbtcSafe,
    impactedPranaSafe,
    netPranaAmount,
  );

  const { poolWbtcReserve, poolPranaReserve } = await fetchPoolReserves(publicClient);
  const poolWbtcBig = toBigInt(poolWbtcReserve);
  const poolPranaBig = toBigInt(poolPranaReserve);

  const poolWbtcSafe = ensurePositiveReserve(poolWbtcBig);
  const poolPranaSafe = ensurePositiveReserve(poolPranaBig);

  const marketWbtc = computeMarketWbtc(poolWbtcSafe, poolPranaSafe, netPranaAmount);
  let reservesSynced = false;

  if (regularBaseline === null) {
    if (marketWbtc === null) {
      return { wbtcQuote: 0n, reservesSynced: false, warning: RESERVE_WARNING_MESSAGE };
    }
    regularBaseline = marketWbtc;
    reservesSynced = true;
  } else if (marketWbtc !== null && regularBaseline > marketWbtc) {
    regularBaseline = marketWbtc;
    reservesSynced = true;
  }

  const [rate] = await publicClient.readContract({
    address: SELL_BOND_ADDRESS,
    abi: SELL_BOND_ABI,
    functionName: 'bondRates',
    args: [period],
  });

  const premiumRate = BigInt(rate);
  const wbtcQuote = FullMath.mulDiv(regularBaseline, 10000n + premiumRate, 10000n);

  // Check if the final WBTC quote exceeds available WBTC balance
  if (wbtcQuote > availableWbtc) {
    return { wbtcQuote: 0n, reservesSynced: false, warning: RESERVE_WARNING_MESSAGE };
  }

  return { wbtcQuote, reservesSynced, warning: '' };
};


