import React, { useMemo } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import useActiveBuyBonds from '../hooks/useActiveBuyBonds';
import { BUY_BOND_ADDRESS, BUY_BOND_ABI } from '../constants/buyBondContract';
import { SELL_BOND_ADDRESS, SELL_BOND_ABI } from '../constants/sellBondContract';
import useActiveSellBonds from '../hooks/useActiveSellBonds';

// Simple loading indicator
const LoadingIndicator = () => <div>Loading bonds...</div>;

// Simple error message display
const ErrorDisplay = ({ message }) => <div style={{ color: 'red' }}>Error: {message}</div>;

// Simple success message display
const SuccessDisplay = ({ message }) => <div style={{ color: 'green' }}>{message}</div>;

const ActiveBonds = () => {
  const { address, isConnected } = useAccount();

  // Fetch user's active buy bonds
  const {
    data: activeBuyBondsData,
    error: fetchBuyError,
    isLoading: isFetchingBuyBonds,
    refetch: refetchBuyBonds // Function to refetch bond data
  } = useReadContract({
    address: BUY_BOND_ADDRESS,
    abi: BUY_BOND_ABI,
    functionName: 'getUserActiveBonds',
    args: [address],
    enabled: isConnected && !!address,
  });

  // Fetch user's active sell bonds
  const {
    data: activeSellBondsData,
    error: fetchSellError,
    isLoading: isFetchingSellBonds,
    refetch: refetchSellBonds // Function to refetch bond data
  } = useReadContract({
    address: SELL_BOND_ADDRESS,
    abi: SELL_BOND_ABI,
    functionName: 'getUserActiveBonds',
    args: [address],
    enabled: isConnected && !!address,
  });

  // Use the custom hook for buy bond logic and actions
  const {
    processedBuyBonds,
    handleBuyClaim,
    actionLoading: buyActionLoading,
    error: buyActionError,
    success: buyActionSuccess,
  } = useActiveBuyBonds(activeBuyBondsData, refetchBuyBonds);

  // Use the custom hook for sell bond logic and actions
  const {
    processedSellBonds,
    handleSellClaim,
    actionLoading: sellActionLoading,
    error: sellActionError,
    success: sellActionSuccess,
  } = useActiveSellBonds(activeSellBondsData, refetchSellBonds);

  // Combine data
  const combinedBonds = useMemo(() => {
    // Add a type property to each bond and combine
    const buyBondsWithType = (processedBuyBonds || []).map(bond => ({ ...bond, bondType: 'buy' }));
    const sellBondsWithType = (processedSellBonds || []).map(bond => ({ ...bond, bondType: 'sell' }));
    // Combine and sort by ID (optional, but good for consistency)
    return [...buyBondsWithType, ...sellBondsWithType].sort((a, b) => a.id - b.id);
  }, [processedBuyBonds, processedSellBonds]);

  // Combined loading and error states
  const isLoading = isFetchingBuyBonds || isFetchingSellBonds;
  const fetchError = fetchBuyError || fetchSellError;
  // Combine action loading states (assuming only one action happens at a time or we show generic loading)
  // More sophisticated handling might be needed if simultaneous claims are possible/desired
  const actionLoadingBondId = buyActionLoading.bondId ?? sellActionLoading.bondId; // Get the ID of the bond being acted upon
  const actionLoadingType = buyActionLoading.bondId ? 'buy' : (sellActionLoading.bondId ? 'sell' : null); // Determine which type is loading

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

      {/* Now check if bonds exist and render them or the 'no bonds' message */}
      {combinedBonds.length === 0 ? (
        <div>You have no active bonds.</div>
      ) : (
        combinedBonds.map((bond) => {
          const isBuyBond = bond.bondType === 'buy';
          const isCurrentActionLoading = actionLoadingBondId === bond.id && actionLoadingType === bond.bondType;

          return (
            <div key={`${bond.bondType}-${bond.id}`} className="bond-card"> {/* Ensure unique key */}
              <div className="bond-header">
                <h3>Bond #{bond.id}</h3>
                <div className="bond-badges"> {/* Container for badges */}
                  <span className={`status-badge status-${bond.status.toLowerCase()}`}>{bond.status}</span>
                  <span className={`bond-type-badge type-${bond.bondType}`}>
                    {isBuyBond ? 'BUYING' : 'SELLING'}
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
                  onClick={() => (isBuyBond ? handleBuyClaim(bond.id) : handleSellClaim(bond.id))}
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