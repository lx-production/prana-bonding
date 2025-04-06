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
        loading,
        isCalculating,
        writeStatus,
        handleApprove,
        handleSellBond,
        pranaBalance,
        minPranaSellAmountFormatted,
        needsApproval,
        calculatedWbtc,
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

    const isInputDisabled = loading || isCalculating;
    const pranaToApprove = pranaAmount; // Direct mapping for selling

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
                        placeholder={`Tối thiểu: ${minPranaSellAmountFormatted} PRANA | Số dư: ${Number(pranaBalance).toFixed(PRANA_DECIMALS)}`}
                        disabled={isInputDisabled}
                        className="form-input"
                    />
                    {/* Show calculated WBTC if input is valid */}
                    {pranaAmount && parseFloat(pranaAmount) > 0 && (
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
                    disabled={!pranaToApprove || parseFloat(pranaToApprove) <= 0 || (loading && writeStatus === 'pending')}
                >
                    {loading && writeStatus === 'pending' ? (
                        <><span className="spinner">↻</span>Approving...</>
                    ) : (
                        `Approve ${pranaToApprove ? Number(pranaToApprove).toFixed(PRANA_DECIMALS) : '0'} PRANA`
                    )}
                </button>

                <button
                    className="btn-primary"
                    onClick={handleSellBond}
                    disabled={needsApproval || isInputDisabled || !pranaAmount || parseFloat(pranaAmount) <= 0}
                >
                    {(loading && writeStatus === 'pending') || isCalculating ? (
                        <><span className="spinner">↻</span>{isCalculating ? 'Calculating...' : 'Selling Bond...'}</>
                    ) : (
                        needsApproval ? 'Approval Required' : 'Sell Bond'
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