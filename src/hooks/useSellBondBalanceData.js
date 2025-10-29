import { useEffect, useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';

import {
  SELL_BOND_ADDRESS_V1,
  SELL_BOND_ADDRESS_V2,
  SELL_BOND_ABI_V1,
  SELL_BOND_ABI_V2,
} from '../constants/sellBondContract';
import { SELL_BOND_BONDS_ABI } from '../constants/bondVolumeFragments';
import { WBTC_ADDRESS, WBTC_ABI, WBTC_DECIMALS, PRANA_DECIMALS } from '../constants/sharedContracts';
import { useCommittedWbtc } from './useCommittedWbtc';
import { useTotalBondPranaVolume } from './useTotalBondPranaVolume';

const SELL_BOND_V1_TOTAL_VOLUME_RAW = parseUnits('194235', PRANA_DECIMALS);

const formatBigIntValue = (value) => {
  const stringValue = value.toString();
  return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const useSellBondBalanceData = () => {
  const {
    data: balanceV1,
    isLoading: isLoadingBalanceV1,
    error: balanceErrorV1,
  } = useReadContract({
    address: WBTC_ADDRESS,
    abi: WBTC_ABI,
    functionName: 'balanceOf',
    args: [SELL_BOND_ADDRESS_V1],
  });

  const {
    data: balanceV2,
    isLoading: isLoadingBalanceV2,
    error: balanceErrorV2,
  } = useReadContract({
    address: WBTC_ADDRESS,
    abi: WBTC_ABI,
    functionName: 'balanceOf',
    args: [SELL_BOND_ADDRESS_V2],
  });

  const {
    committedWbtcRaw: committedWbtcRawV2,
    isLoading: isLoadingCommittedV2,
    error: committedErrorV2,
  } = useCommittedWbtc({
    contractAddress: SELL_BOND_ADDRESS_V2,
    contractAbi: SELL_BOND_ABI_V2,
  });

  const {
    committedWbtcRaw: committedWbtcRawV1,
    isLoading: isLoadingCommittedV1,
    error: committedErrorV1,
  } = useCommittedWbtc({
    contractAddress: SELL_BOND_ADDRESS_V1,
    contractAbi: SELL_BOND_ABI_V1,
  });

  const bondContracts = useMemo(
    () => [
      { address: SELL_BOND_ADDRESS_V2, abi: SELL_BOND_ABI_V2, bondAbi: SELL_BOND_BONDS_ABI },
    ],
    [],
  );

  const {
    totalPranaRaw: totalBondVolumeRawV2,
    isLoading: isLoadingVolume,
    error: bondVolumeError,
  } = useTotalBondPranaVolume({
    contracts: bondContracts,
    fieldName: 'pranaAmount',
    decimals: PRANA_DECIMALS,
  });

  useEffect(() => {
    if (balanceErrorV1) {
      console.error('Sell bond balance V1 error:', balanceErrorV1);
    }
    if (balanceErrorV2) {
      console.error('Sell bond balance V2 error:', balanceErrorV2);
    }
    if (committedErrorV1) {
      console.error('Sell bond committed WBTC V1 error:', committedErrorV1);
    }
    if (committedErrorV2) {
      console.error('Sell bond committed WBTC V2 error:', committedErrorV2);
    }
    if (bondVolumeError) {
      console.error('Sell bond volume error:', bondVolumeError);
    }
  }, [balanceErrorV1, balanceErrorV2, committedErrorV1, committedErrorV2, bondVolumeError]);

  const isLoading =
    isLoadingBalanceV1 ||
    isLoadingBalanceV2 ||
    isLoadingCommittedV1 ||
    isLoadingCommittedV2 ||
    isLoadingVolume;

  const error =
    balanceErrorV1 || balanceErrorV2 || committedErrorV1 || committedErrorV2 || bondVolumeError;

  const totalBalanceRaw = (balanceV1 || 0n) + (balanceV2 || 0n);
  const totalCommittedRaw = (committedWbtcRawV1 || 0n) + (committedWbtcRawV2 || 0n);
  const totalBondVolumeRaw = (totalBondVolumeRawV2 || 0n) + SELL_BOND_V1_TOTAL_VOLUME_RAW;

  const formattedBalanceSat = formatBigIntValue(totalBalanceRaw);
  const formattedCommittedSat = formatBigIntValue(totalCommittedRaw);
  const formattedBondVolume = formatUnits(totalBondVolumeRaw, PRANA_DECIMALS);

  const metrics = useMemo(
    () => [
      {
        key: 'balance',
        label: 'Balance',
        formattedValue: formattedBalanceSat,
        numericValue: Number(totalBalanceRaw),
        rawValue: totalBalanceRaw,
      },
      {
        key: 'committed',
        label: 'Committed',
        formattedValue: formattedCommittedSat,
        numericValue: Number(totalCommittedRaw),
        rawValue: totalCommittedRaw,
      },
      {
        key: 'totalVolume',
        label: 'Total Volume (V1 + V2)',
        formattedValue: formattedBondVolume,
        numericValue: Number.parseFloat(formattedBondVolume),
        rawValue: totalBondVolumeRaw,
      },
    ],
    [
      formattedBalanceSat,
      formattedCommittedSat,
      formattedBondVolume,
      totalBalanceRaw,
      totalCommittedRaw,
      totalBondVolumeRaw,
    ],
  );

  return {
    isLoading,
    error,
    metrics,
  };
};
