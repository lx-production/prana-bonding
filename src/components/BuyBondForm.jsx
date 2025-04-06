import React from 'react';
import useBuyBond from '../hooks/useBuyBond';
import { BOND_TERMS } from '../constants/bondTerms';
import DurationSlider from './DurationSlider';

const BuyBondForm = () => {
    const {
        isConnected,
        inputType,
        setInputType,
        wbtcAmount,
        setWbtcAmount,
        pranaAmount,
        setPranaAmount,
        termIndex,
        setTermIndex,
        bondRates,
        error,
        success,
        isLoading,
        isCalculating,
        writeStatus,
        handleApprove,
        handleBuyBond,
        wbtcBalance,
        minPranaBuyAmountFormatted,
        calculatedPranaForWbtc,
        calculatedWbtcForPrana,
        needsApproval,
    } = useBuyBond();

    if (!isConnected) return <p>Vui lòng kết nối ví của bạn.</p>;

    const handleInputChange = (e, type) => {
        const value = e.target.value;
         // Chỉ cho phép số và dấu thập phân
        if (value === '' || /^[0-9]*[.]?[0-9]*$/.test(value)) {
            if (type === 'WBTC') {
                setWbtcAmount(value);
                if (inputType === 'PRANA') {
                    setInputType('WBTC');
                }
                setPranaAmount('');
            } else { // PRANA
                setPranaAmount(value);
                if (inputType === 'WBTC') {
                    setInputType('PRANA');
                }
                setWbtcAmount('');
            }
        } else {
            console.log('Invalid input value:', value);
        }
    };    
    
    // Use our helper function for display
    const displayPurchasablePrana = isCalculating && inputType === 'WBTC' 
        ? 'Calculating...' 
        : `${Number(calculatedPranaForWbtc).toFixed(9)} PRANA`;

    const displayRequiredWbtc = isCalculating && inputType === 'PRANA' 
        ? 'Calculating...' 
        : `${Number(calculatedWbtcForPrana).toFixed(8)} WBTC`; // Use 8 decimals for WBTC

    const isInputDisabled = isLoading || isCalculating;
    const wbtcToApprove = inputType === 'PRANA' ? calculatedWbtcForPrana : wbtcAmount;

    return (
        <div className="bonding-form" key="bonding-form">
            <h3>Mua PRANA OTC</h3>
            <p style={{marginTop: '10px', marginBottom: '15px', lineHeight: '20px', fontSize: '14px' }}>Bạn sẽ nhận được toàn bộ số PRANA sau thời gian vesting (vẫn có thể claim số PRANA vested trong thời gian này). Thời gian vesting càng lâu, chiết khấu càng lớn.</p>

            <div className="form-group bond-amount-group">
                {/* Input PRANA */}
                <div className="bond-input-section">
                    <label htmlFor="prana-amount">Số lượng PRANA muốn mua</label>
                     <input
                        id="prana-amount"
                        type="text"
                        value={pranaAmount}
                        onChange={(e) => handleInputChange(e, 'PRANA')}
                        placeholder={`Tối thiểu: ${minPranaBuyAmountFormatted} PRANA`}
                        disabled={isInputDisabled}
                        className="form-input"
                    />
                     {/* Show calculated WBTC only when PRANA is the input type and amount is valid */}
                     {inputType === 'PRANA' && pranaAmount && parseFloat(pranaAmount) > 0 && (
                        <div className="calculated-amount">
                            Cần trả: <strong>{displayRequiredWbtc}</strong>
                        </div>
                    )}
                </div>

                {/* Input WBTC */}
                <div className="bond-input-section">
                    <label htmlFor="wbtc-amount">Số lượng WBTC muốn bán</label>
                    <input
                        id="wbtc-amount"
                        type="text"
                        value={wbtcAmount}
                        onChange={(e) => handleInputChange(e, 'WBTC')}
                        placeholder={`${parseFloat(wbtcBalance).toFixed(8)} WBTC`}
                        disabled={isInputDisabled}
                        className="form-input"
                    />
                    {/* Show calculated PRANA only when WBTC is the input type and amount is valid */}
                    {inputType === 'WBTC' && wbtcAmount && parseFloat(wbtcAmount) > 0 && (
                        <div className="calculated-amount">
                            Nhận được: <strong>{displayPurchasablePrana}</strong>
                        </div>
                    )}
                </div>                
            </div>

            <div className="form-group">
                 <div id="term-label" className="form-label">Chọn kỳ hạn Bond - Thời gian vesting</div>
                 <DurationSlider
                    selectedIndex={termIndex}
                    setSelectedIndex={setTermIndex}
                    options={BOND_TERMS}
                    valueMap={bondRates}
                    valueKey="rate"
                    valueLabelSuffix="% chiết khấu"
                    disabled={isLoading || isCalculating}
                    labelId="term-label"
                 />
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="action-buttons">
                <button
                    className="btn-secondary"
                    onClick={handleApprove}
                    // disabled={isApproveDisabled}
                >
                    {isLoading && writeStatus === 'pending' ? (
                        <><span className="spinner">↻</span>Approving...</>
                    ) : (
                        // Use the validated wbtcToApprove and format it
                            `Approve ${wbtcToApprove ? Number(wbtcToApprove).toFixed(8) : '0.00000000'} WBTC`
                    )}
                </button>

                <button
                    className="btn-primary"
                    onClick={handleBuyBond}
                    // Combine all disable conditions
                    disabled={needsApproval || (isLoading && writeStatus === 'pending') || isCalculating}
                >
                    {(isLoading && writeStatus === 'pending') || isCalculating ? (
                        <><span className="spinner">↻</span>{isCalculating ? 'Calculating...' : 'Buying Bond...'}</>
                    ) : (
                         needsApproval ? 'Approval Required' : 'Buy Bond'
                    )}
                </button>
            </div>

             <div className="info-notes">
                <p>Lưu ý: Bạn cần phê duyệt (approve) WBTC cho hợp đồng Bond trước khi thực hiện giao dịch mua.</p>
            </div>
        </div>
    );
};

export default BuyBondForm;
