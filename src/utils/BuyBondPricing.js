import { FullMath } from './FullMath';
import { toBigInt, ensurePositiveReserve } from './bigint-utils';
import { fetchPoolReserves } from './UniswapV3Helper';
import { BUY_BOND_ADDRESS, BUY_BOND_ABI } from '../constants/buyBondContract';
import { fetchImpactedReserves, computeRegularWbtcFromImpacted, computeRegularPranaFromImpacted, computeMarketWbtc, computeMarketPrana, fetchAvailableTreasuryPrana, IMPACTED_RESERVE_WARNING, TREASURY_WARNING } from './buy-bond-reserve-utils';

export const calculateWbtcQuote = async ({ pranaAmountWei, period, publicClient }) => {
  if (!publicClient) {
    return { wbtcQuote: 0n, reservesSynced: false, warning: '' };
  }

  const { impactedWbtcReserve, impactedPranaReserve } = await fetchImpactedReserves(publicClient);
  const impactedWbtcBig = toBigInt(impactedWbtcReserve);
  const impactedPranaBig = toBigInt(impactedPranaReserve);

  if (pranaAmountWei >= impactedPranaBig) {
    return {
      wbtcQuote: 0n,
      reservesSynced: false,
      warning: IMPACTED_RESERVE_WARNING
    };
  }

  const availableTreasuryPrana = await fetchAvailableTreasuryPrana(publicClient);
  if (pranaAmountWei > availableTreasuryPrana) {
    return {
      wbtcQuote: 0n,
      reservesSynced: false,
      warning: TREASURY_WARNING
    };
  }

  const impactedWbtcSafe = ensurePositiveReserve(impactedWbtcBig);
  const impactedPranaSafe = ensurePositiveReserve(impactedPranaBig);

  const { poolWbtcReserve, poolPranaReserve } = await fetchPoolReserves(publicClient);
  const poolWbtcBig = toBigInt(poolWbtcReserve);
  const poolPranaBig = toBigInt(poolPranaReserve);

  if (pranaAmountWei >= poolPranaBig) {
    return {
      wbtcQuote: 0n,
      reservesSynced: false,
      warning: IMPACTED_RESERVE_WARNING
    };
  }

  const poolWbtcSafe = ensurePositiveReserve(poolWbtcBig);
  const poolPranaSafe = ensurePositiveReserve(poolPranaBig);

  const marketWbtc = computeMarketWbtc(poolWbtcSafe, poolPranaSafe, pranaAmountWei);
  let regularBaseline = computeRegularWbtcFromImpacted(
    impactedWbtcSafe,
    impactedPranaSafe,
    pranaAmountWei
  );
  let reservesSynced = false;

  if (regularBaseline === null) {
    if (marketWbtc === null) {
      return { wbtcQuote: 0n, reservesSynced: false, warning: IMPACTED_RESERVE_WARNING };
    }
    regularBaseline = marketWbtc;
    reservesSynced = true;
  } else if (marketWbtc !== null && regularBaseline < marketWbtc) {
    regularBaseline = marketWbtc;
    reservesSynced = true;
  }

  const [rate] = await publicClient.readContract({
    address: BUY_BOND_ADDRESS,
    abi: BUY_BOND_ABI,
    functionName: 'bondRates',
    args: [period]
  });

  const discountRate = BigInt(rate);
  const discountedWbtc = FullMath.mulDiv(regularBaseline, 10000n - discountRate, 10000n);
  const wbtcAfterFee = FullMath.mulDiv(discountedWbtc, 100n, 99n);

  return { wbtcQuote: wbtcAfterFee, reservesSynced, warning: '' };
};


export const calculatePranaQuote = async ({ wbtcAmountWei, period, publicClient }) => {
  if (!publicClient) {
    return { pranaQuote: 0n, reservesSynced: false, warning: '' };
  }

  const { impactedWbtcReserve, impactedPranaReserve } = await fetchImpactedReserves(publicClient);
  const impactedWbtcSafe = ensurePositiveReserve(impactedWbtcReserve);
  const impactedPranaSafe = ensurePositiveReserve(impactedPranaReserve);

  const wbtcAfterFee = FullMath.mulDiv(wbtcAmountWei, 99n, 100n);
  const regularPranaFromImpacted = computeRegularPranaFromImpacted(
    impactedWbtcSafe,
    impactedPranaSafe,
    wbtcAfterFee // 1% fee included
  );

  if (regularPranaFromImpacted === null || regularPranaFromImpacted >= impactedPranaSafe) {
    return {
      pranaQuote: 0n,
      reservesSynced: false,
      warning: IMPACTED_RESERVE_WARNING
    };
  }

  const availableTreasuryPrana = await fetchAvailableTreasuryPrana(publicClient);
  if (regularPranaFromImpacted > availableTreasuryPrana) {
    return {
      pranaQuote: 0n,
      reservesSynced: false,
      warning: TREASURY_WARNING
    };
  }

  const { poolWbtcReserve, poolPranaReserve } = await fetchPoolReserves(publicClient);
  const poolWbtcSafe = ensurePositiveReserve(poolWbtcReserve);
  const poolPranaSafe = ensurePositiveReserve(poolPranaReserve);

  const marketPrana = computeMarketPrana(poolWbtcSafe, poolPranaSafe, wbtcAfterFee); // 1% fee included
  let regularBaseline = regularPranaFromImpacted;
  let reservesSynced = false;

  if (marketPrana !== null && regularBaseline > marketPrana) {
    regularBaseline = marketPrana;
    reservesSynced = true;
  }

  const [rate] = await publicClient.readContract({
    address: BUY_BOND_ADDRESS,
    abi: BUY_BOND_ABI,
    functionName: 'bondRates',
    args: [period]
  });

  const discountRate = BigInt(rate);
  const pranaQuote = FullMath.mulDiv(regularBaseline, 10000n, 10000n - discountRate);

  return { pranaQuote, reservesSynced, warning: '' };
};


