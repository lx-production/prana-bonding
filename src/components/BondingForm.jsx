import React from 'react';
import useBonding from '../hooks/useBonding';
import { BOND_TERM_OPTIONS } from '../constants/bondingTerms'; // Import options
// Giả sử bạn có hoặc điều chỉnh DurationSlider cho phù hợp với Bond Terms
import DurationSlider from './DurationSlider';

const BondingForm = () => {
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
        writeStatus,
        handleApprove,
        handleBuyBond,
        wbtcBalance,
        minPranaBuyAmountFormatted,
        needsApproval,
        // requiredWbtc, // Giá trị tính toán được (khi có)
        // purchasablePrana, // Giá trị tính toán được (khi có)
    } = useBonding();

    // TODO: Lấy giá trị tính toán (requiredWbtc/purchasablePrana) từ hook khi có
    const displayRequiredWbtc = '...'; // Placeholder
    const displayPurchasablePrana = '...'; // Placeholder

    if (!isConnected) return <p>Vui lòng kết nối ví của bạn.</p>;

    const handleInputChange = (e, type) => {
        const value = e.target.value;
         // Chỉ cho phép số và dấu thập phân
        if (value === '' || /^[0-9]*[.]?[0-9]*$/.test(value)) {
            if (type === 'WBTC') {
                setWbtcAmount(value);
                if (inputType === 'PRANA') setInputType('WBTC'); // Tự động chuyển đổi input type
                 // Xóa trường kia để tránh nhầm lẫn khi tính toán
                setPranaAmount('');
            } else { // PRANA
                setPranaAmount(value);
                if (inputType === 'WBTC') setInputType('PRANA');
                 // Xóa trường kia
                setWbtcAmount('');
            }
        }
    };

    const isInputDisabled = isLoading;
    const isApproveDisabled = isLoading || !needsApproval || !wbtcAmount || parseFloat(wbtcAmount) <= 0;
    // Disable nút Buy nếu đang loading, hoặc cần approve mà chưa approve, hoặc chưa nhập đủ thông tin
    const isBuyDisabled = isLoading || needsApproval || (inputType === 'WBTC' ? !wbtcAmount : !pranaAmount) || (inputType === 'WBTC' ? parseFloat(wbtcAmount) <= 0 : parseFloat(pranaAmount) <= 0) ;


    return (
        <div className="bonding-form" key="bonding-form">
            <h3>Mua PRANA Bond</h3>
            <p>Mua PRANA với giá chiết khấu bằng cách khóa WBTC trong một khoảng thời gian.</p>

            <div className="form-group bond-amount-group">
                {/* Input WBTC */}
                <div className="bond-input-section">
                    <label htmlFor="wbtc-amount">Số lượng WBTC</label>
                    <input
                        id="wbtc-amount"
                        type="text"
                        value={wbtcAmount}
                        onChange={(e) => handleInputChange(e, 'WBTC')}
                        placeholder={`Số dư: ${parseFloat(wbtcBalance).toFixed(6)} WBTC`}
                        disabled={isInputDisabled}
                        className="form-input"
                    />
                    {inputType === 'WBTC' && (
                        <div className="calculated-amount">
                            Ước tính nhận: <strong>≈ {displayPurchasablePrana} PRANA</strong>
                        </div>
                    )}
                </div>

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
                     {inputType === 'PRANA' && (
                        <div className="calculated-amount">
                            Cần trả: <strong>≈ {displayRequiredWbtc} WBTC</strong>
                        </div>
                    )}
                </div>
            </div>

            <div className="form-group">
                 <div id="term-label" className="form-label">Chọn kỳ hạn Bond</div>
                {/* TODO: Điều chỉnh DurationSlider hoặc tạo BondTermSlider */}
                {/* Cần truyền `bondRates` vào slider để hiển thị tỷ lệ % */}
                 <DurationSlider
                    // Giả sử slider có thể nhận options và rates khác nhau
                    durationIndex={termIndex}
                    setDurationIndex={setTermIndex}
                    durationOptions={BOND_TERM_OPTIONS} // Sử dụng options cho bond
                    aprs={bondRates} // Truyền rates để slider hiển thị (cần điều chỉnh tên prop nếu cần)
                    disabled={isLoading}
                    labelId="term-label"
                 />
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="action-buttons">
                {/* Nút Approve chỉ hiển thị khi cần */}
                {needsApproval && (
                     <button
                        className="btn-primary"
                        onClick={handleApprove}
                        disabled={isApproveDisabled}
                    >
                        {isLoading && writeStatus === 'pending' ? ( // Chỉ hiển thị spinner khi đang gửi tx approve
                            <><span className="spinner">↻</span>Đang phê duyệt...</>
                        ) : (
                            `Phê duyệt ${wbtcAmount} WBTC`
                        )}
                    </button>
                )}

                 <button
                    className={`btn-secondary ${needsApproval ? '' : 'btn-full-width'}`} // Nút Buy chiếm toàn bộ chiều rộng nếu không có nút Approve
                    onClick={handleBuyBond}
                    disabled={isBuyDisabled}
                 >
                    {isLoading && (writeStatus === 'pending') ? ( // Spinner khi đang gửi tx hoặc chờ xác nhận
                        <><span className="spinner">↻</span>Đang mua Bond...</>
                    ) : (
                        'Mua Bond'
                    )}
                </button>
            </div>

             <div className="info-notes">
                <p>Lưu ý: Bạn cần phê duyệt (approve) WBTC cho hợp đồng Bond trước khi thực hiện giao dịch mua.</p>
                {/* Thêm các lưu ý khác nếu cần */}
            </div>
        </div>
    );
};

export default BondingForm;
