import React from 'react';
import { useAccount, useReadContract } from 'wagmi';
import useActiveBonds from '../hooks/useActiveBonds';
import { BUY_BOND_ADDRESS, BUY_BOND_ABI } from '../constants/buyBondContract';

// Simple loading indicator
const LoadingIndicator = () => <div>Loading bonds...</div>;

// Simple error message display
const ErrorDisplay = ({ message }) => <div style={{ color: 'red' }}>Error: {message}</div>;

// Simple success message display
const SuccessDisplay = ({ message }) => <div style={{ color: 'green' }}>{message}</div>;

const ActiveBonds = () => {
  const { address, isConnected } = useAccount();

  // Fetch user's active bonds
  const {
    data: activeBondsData,
    error: fetchError,
    isLoading: isFetchingBonds,
    refetch: refetchBonds // Function to refetch bond data
  } = useReadContract({
    address: BUY_BOND_ADDRESS,
    abi: BUY_BOND_ABI,
    functionName: 'getUserActiveBonds',
    args: [address],
    enabled: isConnected && !!address,
  });

  // Use the custom hook for bond logic and actions
  const {
    processedBonds,
    handleClaimBond,
    actionLoading,
    error: actionError,
    success: actionSuccess,
  } = useActiveBonds(activeBondsData, refetchBonds);

  // Display loading indicator while fetching
  if (isFetchingBonds) {
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

      {/* Display action messages */}
      {actionError && <ErrorDisplay message={actionError} />}
      {actionSuccess && <SuccessDisplay message={actionSuccess} />}      

      {/* Now check if bonds exist and render them or the 'no bonds' message */}
      {(!processedBonds || processedBonds.length === 0) ? (
        <div>You have no active bonds.</div>
      ) : (
        processedBonds.map((bond) => (
          <div key={bond.id} className="bond-card"> {/* Reuse styling from staking if possible */}
            <div className="bond-header">
              <h3>Bond #{bond.id}</h3>
              <span className={`status-badge status-${bond.status.toLowerCase()}`}>{bond.status}</span>
            </div>

            <div className="bond-info">
              <div className="info-row">
                <span>Principal (WBTC):</span>
                <span>{bond.wbtcAmountFormatted} WBTC</span>
              </div>
              <div className="info-row">
                <span>Total PRANA in Bond:</span>
                <span>{bond.pranaAmountFormatted} PRANA</span>
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
                <span>Claimed PRANA:</span>
                <span>{bond.claimedPranaFormatted} PRANA</span>
              </div>
              <div className="info-row">
                <span>Currently Claimable:</span>
                <span style={{ fontWeight: 'bold' }}>{bond.claimablePranaFormatted} PRANA</span>
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
               {/* Single Claim Button */}
              <button
                className="claim-button primary-button" // Use existing button styles
                onClick={() => handleClaimBond(bond.id)}
                disabled={!bond.canClaim || actionLoading.bondId === bond.id}
              >
                {actionLoading.bondId === bond.id && actionLoading.action === 'claim'
                  ? 'Claiming...'
                  : 'Claim PRANA'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ActiveBonds;