import React from 'react';
import useSellBond from '../hooks/useSellBond';
import { BOND_TERMS } from '../constants/bondTerms';
import DurationSlider from './DurationSlider';
import { PRANA_DECIMALS, WBTC_DECIMALS } from '../constants/sharedContracts'; // Import decimals

const SellBondForm = () => {
    const {
        isConnected,
        pranaAmount,
        setPranaAmount,
        termIndex,
        setTermIndex,
        bondRates,
        error,
        success,
        // isLoading now covers both sending and waiting for confirmation
        loading: isLoading,
        isCalculating,
        // writeStatus, // Might not be needed directly
        handleApprove,
        handleSellBond,
        pranaBalance,
        minPranaSellAmountFormatted,
        needsApproval,
        calculatedWbtc,
        // Import the new state variables
        isWaitingForApprovalConfirmation,
        isValidPranaInput,
        // approveTxHash, // Import if needed for display
    } = useSellBond();

    if (!isConnected) return <p>Vui lòng kết nối ví của bạn.</p>;

    const handleInputChange = (e) => {
        const value = e.target.value;
        // Allow only numbers and a single decimal point
        if (value === '' || /^[0-9]*[.]?[0-9]*$/.test(value)) {
            setPranaAmount(value);
        } else {
            console.log('Invalid input value:', value);
        }
    };

    // Display the calculated WBTC amount user will receive
    const displayReceivedWbtc = isCalculating
        ? 'Calculating...'
        : `${Number(calculatedWbtc).toFixed(WBTC_DECIMALS)} WBTC`;

    // Helper variable for overall operation status
    const isOperationInProgress = isLoading || isCalculating;
    const isInputDisabled = isOperationInProgress; // Simplified

    return (
        <div className="bonding-form" key="sell-bonding-form"> {/* Added key for potential re-renders */}
            <h3>Bán PRANA OTC</h3>
            <p style={{ marginTop: '10px', marginBottom: '15px', lineHeight: '20px', fontSize: '15px' }}>
                Bạn sẽ nhận được WBTC với tỷ giá premium so với thị trường. Số WBTC này sẽ được trả dần trong suốt kỳ hạn bond (vesting). Kỳ hạn càng dài, premium càng cao.
            </p>

            <div className="form-group bond-amount-group">
                {/* Input PRANA */}
                <div className="bond-input-section">
                    <label htmlFor="prana-sell-amount">Số lượng PRANA muốn bán</label>
                    <input
                        id="prana-sell-amount"
                        type="text"
                        value={pranaAmount}
                        onChange={handleInputChange}
                        placeholder={`Tối thiểu: ${minPranaSellAmountFormatted} PRANA (${parseFloat(pranaBalance).toFixed(PRANA_DECIMALS)} available)`} // Added available balance hint
                        disabled={isInputDisabled}
                        className="form-input"
                    />
                    {/* Show calculated WBTC if input is valid */}
                    {isValidPranaInput && ( // Use validity check
                        <div className="calculated-amount">
                            Sẽ nhận được: <strong>{displayReceivedWbtc}</strong>
                        </div>
                    )}
                </div>
            </div>

            <div className="form-group">
                <div id="sell-term-label" className="form-label">Chọn kỳ hạn Bond - Thời gian vesting</div>
                <DurationSlider
                    selectedIndex={termIndex}
                    setSelectedIndex={setTermIndex}
                    options={BOND_TERMS}
                    valueMap={bondRates} // Sell bond rates provide the premium rate
                    valueKey="rate" // The 'rate' field in sell bondRates represents the premium
                    valueLabelSuffix="% premium" // Label indicating it's a premium
                    disabled={isInputDisabled}
                    labelId="sell-term-label"
                />
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="action-buttons">
                <button
                    className="btn-secondary"
                    onClick={handleApprove}
                    // Disable if an operation is in progress OR if approval isn't needed
                    disabled={isOperationInProgress || !needsApproval || !isValidPranaInput} // Also disable if input is invalid
                >
                    {/* More specific loading states for Approve button */}
                    {isWaitingForApprovalConfirmation ? (
                        <><span className="spinner">↻</span>Confirming...</>
                    ) : isLoading && !isCalculating ? ( // Check if loading is specifically for approve tx sending
                        <><span className="spinner">↻</span>Sending Approve...</>
                    ) : (
                        `1. Approve PRANA`
                    )}
                </button>

                <button
                    className="btn-primary"
                    onClick={handleSellBond}
                    // Update the disabled condition
                    disabled={
                        needsApproval ||
                        isOperationInProgress ||
                        !isValidPranaInput // Disable if input is not valid
                    }
                >
                    {isOperationInProgress ? (
                         <><span className="spinner">↻</span>{isCalculating ? 'Calculating...' : 'Processing...'}</>
                    ) : (
                        needsApproval ? 'Approval Required' : '2. Sell Bond'
                    )}
                </button>
            </div>

            <div className="info-notes">
                <p>Lưu ý: Bạn cần phê duyệt (approve) PRANA cho hợp đồng Bond trước khi thực hiện giao dịch bán.</p>
            </div>
        </div>
    );
};

export default SellBondForm;