import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import useActiveBuyBonds from '../hooks/useActiveBuyBonds';
import {
  BUY_BOND_ADDRESS_V1,
  BUY_BOND_ABI_V1,
  BUY_BOND_ADDRESS_V2,
  BUY_BOND_ABI_V2,
} from '../constants/buyBondContract';
import {
  SELL_BOND_ADDRESS_V1,
  SELL_BOND_ABI_V1,
  SELL_BOND_ADDRESS_V2,
  SELL_BOND_ABI_V2,
} from '../constants/sellBondContract';
import useActiveSellBonds from '../hooks/useActiveSellBonds';

// Simple loading indicator
const LoadingIndicator = () => <div>Loading bonds...</div>;

// Simple error message display
const ErrorDisplay = ({ message }) => <div style={{ color: 'red' }}>Error: {message}</div>;

// Simple success message display
const SuccessDisplay = ({ message }) => <div style={{ color: 'green' }}>{message}</div>;

ErrorDisplay.propTypes = {
  message: PropTypes.string.isRequired,
};

SuccessDisplay.propTypes = {
  message: PropTypes.string.isRequired,
};

const ActiveBonds = () => {
  const { address, isConnected } = useAccount();

  // Fetch user's active buy bonds (V2)
  const {
    data: activeBuyBondsData,
    error: fetchBuyError,
    isLoading: isFetchingBuyBonds,
    refetch: refetchBuyBonds // Function to refetch bond data
  } = useReadContract({
    address: BUY_BOND_ADDRESS_V2,
    abi: BUY_BOND_ABI_V2,
    functionName: 'getUserActiveBonds',
    args: [address],
    enabled: isConnected && !!address,
  });

  // Fetch user's active buy bonds (V1)
  const {
    data: activeBuyBondsDataV1,
    error: fetchBuyErrorV1,
    isLoading: isFetchingBuyBondsV1,
    refetch: refetchBuyBondsV1
  } = useReadContract({
    address: BUY_BOND_ADDRESS_V1,
    abi: BUY_BOND_ABI_V1,
    functionName: 'getUserActiveBonds',
    args: [address],
    enabled: isConnected && !!address,
  });

  // Fetch user's active sell bonds (V2)
  const {
    data: activeSellBondsData,
    error: fetchSellError,
    isLoading: isFetchingSellBonds,
    refetch: refetchSellBonds // Function to refetch bond data
  } = useReadContract({
    address: SELL_BOND_ADDRESS_V2,
    abi: SELL_BOND_ABI_V2,
    functionName: 'getUserActiveBonds',
    args: [address],
    enabled: isConnected && !!address,
  });

  // Fetch user's active sell bonds (V1)
  const {
    data: activeSellBondsDataV1,
    error: fetchSellErrorV1,
    isLoading: isFetchingSellBondsV1,
    refetch: refetchSellBondsV1
  } = useReadContract({
    address: SELL_BOND_ADDRESS_V1,
    abi: SELL_BOND_ABI_V1,
    functionName: 'getUserActiveBonds',
    args: [address],
    enabled: isConnected && !!address,
  });

  // Use the custom hook for buy bond logic and actions (V2)
  const {
    processedBuyBonds,
    handleBuyClaim,
    actionLoading: buyActionLoading,
    error: buyActionError,
    success: buyActionSuccess,
  } = useActiveBuyBonds(activeBuyBondsData, refetchBuyBonds, {
    contractAddress: BUY_BOND_ADDRESS_V2,
    contractAbi: BUY_BOND_ABI_V2,
  });

  // Use the custom hook for buy bond logic and actions (V1)
  const {
    processedBuyBonds: processedBuyBondsV1,
    handleBuyClaim: handleBuyClaimV1,
    actionLoading: buyActionLoadingV1,
    error: buyActionErrorV1,
    success: buyActionSuccessV1,
  } = useActiveBuyBonds(activeBuyBondsDataV1, refetchBuyBondsV1, {
    contractAddress: BUY_BOND_ADDRESS_V1,
    contractAbi: BUY_BOND_ABI_V1,
  });

  // Use the custom hook for sell bond logic and actions (V2)
  const {
    processedSellBonds,
    handleSellClaim,
    actionLoading: sellActionLoading,
    error: sellActionError,
    success: sellActionSuccess,
  } = useActiveSellBonds(activeSellBondsData, refetchSellBonds, {
    contractAddress: SELL_BOND_ADDRESS_V2,
    contractAbi: SELL_BOND_ABI_V2,
  });

  // Use the custom hook for sell bond logic and actions (V1)
  const {
    processedSellBonds: processedSellBondsV1,
    handleSellClaim: handleSellClaimV1,
    actionLoading: sellActionLoadingV1,
    error: sellActionErrorV1,
    success: sellActionSuccessV1,
  } = useActiveSellBonds(activeSellBondsDataV1, refetchSellBondsV1, {
    contractAddress: SELL_BOND_ADDRESS_V1,
    contractAbi: SELL_BOND_ABI_V1,
  });

  // Combine data
  const combinedBonds = useMemo(() => {
    const buyV2 = (processedBuyBonds || []).map(bond => ({ ...bond, bondType: 'buy', version: 'v2', claimHandler: handleBuyClaim }));
    const buyV1 = (processedBuyBondsV1 || []).map(bond => ({ ...bond, bondType: 'buy', version: 'v1', claimHandler: handleBuyClaimV1 }));
    const sellV2 = (processedSellBonds || []).map(bond => ({ ...bond, bondType: 'sell', version: 'v2', claimHandler: handleSellClaim }));
    const sellV1 = (processedSellBondsV1 || []).map(bond => ({ ...bond, bondType: 'sell', version: 'v1', claimHandler: handleSellClaimV1 }));

    return [...buyV2, ...sellV2, ...buyV1, ...sellV1].sort((a, b) => a.id - b.id);
  }, [processedBuyBonds, processedSellBonds, processedBuyBondsV1, processedSellBondsV1, handleBuyClaim, handleSellClaim, handleBuyClaimV1, handleSellClaimV1]);

  // Combined loading and error states
  const isLoading = isFetchingBuyBonds || isFetchingSellBonds || isFetchingBuyBondsV1 || isFetchingSellBondsV1;
  const fetchError = fetchBuyError || fetchSellError || fetchBuyErrorV1 || fetchSellErrorV1;

  const actionLoadingBondId = buyActionLoading.bondId ?? sellActionLoading.bondId ?? buyActionLoadingV1.bondId ?? sellActionLoadingV1.bondId;
  const actionLoadingType = buyActionLoading.bondId
    ? 'buy-v2'
    : sellActionLoading.bondId
      ? 'sell-v2'
      : buyActionLoadingV1.bondId
        ? 'buy-v1'
        : sellActionLoadingV1.bondId
          ? 'sell-v1'
          : null;

  // Display loading indicator while fetching
  if (isLoading) {
    return <LoadingIndicator />;
  }

  // Display error if fetching failed
  if (fetchError) {
    return <ErrorDisplay message={`Failed to fetch bonds: ${fetchError.shortMessage || fetchError.message}`} />;
  }

  // Handle case where user is not connected
  if (!isConnected) {
    return <div>Please connect your wallet to view your bonds.</div>;
  }  

  return (
    <div className="active-bonds-container">
      <h2>My Active Bonds</h2>

      {/* Display action messages from both hooks */}
      {buyActionError && <ErrorDisplay message={buyActionError} />}
      {buyActionSuccess && <SuccessDisplay message={buyActionSuccess} />}
      {sellActionError && <ErrorDisplay message={sellActionError} />}
      {sellActionSuccess && <SuccessDisplay message={sellActionSuccess} />}
      {buyActionErrorV1 && <ErrorDisplay message={buyActionErrorV1} />}
      {buyActionSuccessV1 && <SuccessDisplay message={buyActionSuccessV1} />}
      {sellActionErrorV1 && <ErrorDisplay message={sellActionErrorV1} />}
      {sellActionSuccessV1 && <SuccessDisplay message={sellActionSuccessV1} />}

      {/* Now check if bonds exist and render them or the 'no bonds' message */}
      {combinedBonds.length === 0 ? (
        <div>You have no active bonds.</div>
      ) : (
        combinedBonds.map((bond) => {
          const isBuyBond = bond.bondType === 'buy';
          const expectedActionKey = `${bond.bondType}-${bond.version}`;
          const isCurrentActionLoading = actionLoadingBondId === bond.id && actionLoadingType === expectedActionKey;

          return (
            <div key={`${bond.bondType}-${bond.id}`} className="bond-card"> {/* Ensure unique key */}
              <div className="bond-header">
                <h3>Bond #{bond.id}</h3>
                <div className="bond-badges"> {/* Container for badges */}
                  <span className={`status-badge status-${bond.status.toLowerCase()}`}>{bond.status}</span>
                  <span className={`bond-type-badge type-${bond.bondType}`}>
                    {isBuyBond ? 'BUYING' : 'SELLING'}
                  </span>
                  <span className={`bond-version-badge version-${bond.version}`}>
                    {bond.version.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="bond-info">
                <div className="info-row">
                  <span>Principal ({isBuyBond ? 'WBTC Sent' : 'PRANA Sent'}):</span>
                  <span>{isBuyBond ? `${bond.wbtcAmountFormatted} WBTC` : `${bond.pranaAmountFormatted} PRANA`}</span>
                </div>
                <div className="info-row">
                  <span>Payout ({isBuyBond ? 'PRANA Total' : 'WBTC Total'}):</span>
                  <span>{isBuyBond ? `${bond.pranaAmountFormatted} PRANA` : `${bond.wbtcAmountFormatted} WBTC`}</span>
                </div>
                <div className="info-row">
                  <span>Start Time:</span>
                  <span>{bond.creationTimeFormatted}</span>
                </div>
                <div className="info-row">
                  <span>Maturity Time:</span>
                  <span>{bond.maturityTimeFormatted}</span>
                </div>
                <div className="info-row">
                  <span>Claimed Payout:</span>
                  <span>{isBuyBond ? `${bond.claimedPranaFormatted} PRANA` : `${bond.claimedWbtcFormatted} WBTC`}</span>
                </div>
                <div className="info-row">
                  <span>Currently Claimable:</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {isBuyBond ? `${bond.claimablePranaFormatted} PRANA` : `${bond.claimableWbtcFormatted} WBTC`}
                  </span>
                </div>
              </div>

              <div className="bond-progress">
                <div className="progress-bar-container">
                  <div
                    className="progress-bar"
                    style={{ width: `${bond.progress}%` }}
                  ></div>
                </div>
                <span>{bond.progress}% Vested</span>
              </div>

              <div className="bond-actions">
                <button
                  className="claim-button primary-button" // Use existing button styles
                  onClick={() => bond.claimHandler(bond.id)}
                  disabled={!bond.canClaim || isCurrentActionLoading}
                >
                  {isCurrentActionLoading
                    ? 'Claiming...'
                    : `Claim ${isBuyBond ? 'PRANA' : 'WBTC'}`}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ActiveBonds;