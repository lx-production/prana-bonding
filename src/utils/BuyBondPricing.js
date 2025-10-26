import { FullMath } from './FullMath';
import { toBigInt, extractResult, ensurePositiveReserve } from './bigint-utils';
import { fetchPoolReserves } from './UniswapV3Helper';
import { BUY_BOND_ADDRESS, BUY_BOND_ABI } from '../constants/buyBondContract';
import { PRANA_ADDRESS, PRANA_ABI } from '../constants/sharedContracts';

const RESERVE_WARNING_MESSAGE = 'Lượng PRANA muốn mua vượt quá nguồn cung có thể bán.';
const TREASURY_WARNING_MESSAGE = 'Kho PRANA không đủ để bán số lượng yêu cầu.';

const fetchImpactedReserves = async (publicClient) => {
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

const computeRegularWbtcFromImpacted = (impactedWbtc, impactedPrana, pranaAmount) => {
  const impactedWbtcBig = toBigInt(impactedWbtc);
  const impactedPranaBig = toBigInt(impactedPrana);
  const pranaAmountBig = toBigInt(pranaAmount);

  const denominator = impactedPranaBig - pranaAmountBig;
  if (denominator <= 0n) {
    return null;
  }
  return FullMath.mulDiv(impactedWbtcBig, pranaAmountBig, denominator);
};

const computeRegularPranaFromImpacted = (impactedWbtc, impactedPrana, wbtcAfterFee) => {
  const impactedWbtcBig = toBigInt(impactedWbtc);
  const impactedPranaBig = toBigInt(impactedPrana);
  const wbtcAfterFeeBig = toBigInt(wbtcAfterFee);

  return FullMath.mulDiv(impactedPranaBig, wbtcAfterFeeBig, impactedWbtcBig + wbtcAfterFeeBig);
};

const computeMarketWbtc = (poolWbtc, poolPrana, pranaAmount) => {
  const poolWbtcBig = toBigInt(poolWbtc);
  const poolPranaBig = toBigInt(poolPrana);
  const pranaAmountBig = toBigInt(pranaAmount);

  const denominator = poolPranaBig - pranaAmountBig;
  if (denominator <= 0n) {
    return null;
  }
  return FullMath.mulDiv(poolWbtcBig, pranaAmountBig, denominator);
};

const computeMarketPrana = (poolWbtc, poolPrana, wbtcAfterFee) => {
  const poolWbtcBig = toBigInt(poolWbtc);
  const poolPranaBig = toBigInt(poolPrana);
  const wbtcAfterFeeBig = toBigInt(wbtcAfterFee);

  return FullMath.mulDiv(poolPranaBig, wbtcAfterFeeBig, poolWbtcBig + wbtcAfterFeeBig);
};

const fetchAvailableTreasuryPrana = async (publicClient) => {
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
      warning: RESERVE_WARNING_MESSAGE
    };
  }

  const availableTreasuryPrana = await fetchAvailableTreasuryPrana(publicClient);
  if (pranaAmountWei > availableTreasuryPrana) {
    return {
      wbtcQuote: 0n,
      reservesSynced: false,
      warning: TREASURY_WARNING_MESSAGE
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
      warning: RESERVE_WARNING_MESSAGE
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
      return { wbtcQuote: 0n, reservesSynced: false, warning: RESERVE_WARNING_MESSAGE };
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
    return { pranaQuote: 0n, reservesSynced: false };
  }

  const { impactedWbtcReserve, impactedPranaReserve } = await fetchImpactedReserves(publicClient);
  const impactedWbtcSafe = ensurePositiveReserve(impactedWbtcReserve);
  const impactedPranaSafe = ensurePositiveReserve(impactedPranaReserve);

  const wbtcAfterFee = FullMath.mulDiv(wbtcAmountWei, 99n, 100n);
  const regularPranaFromImpacted = computeRegularPranaFromImpacted(
    impactedWbtcSafe,
    impactedPranaSafe,
    wbtcAfterFee
  );

  const { poolWbtcReserve, poolPranaReserve } = await fetchPoolReserves(publicClient);
  const poolWbtcSafe = ensurePositiveReserve(poolWbtcReserve);
  const poolPranaSafe = ensurePositiveReserve(poolPranaReserve);

  const marketPrana = computeMarketPrana(poolWbtcSafe, poolPranaSafe, wbtcAfterFee);
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

  return { pranaQuote, reservesSynced };
};


