import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { BOND_CONTRACT_ADDRESS, BOND_CONTRACT_ABI, WBTC_ADDRESS, WBTC_ABI, PRANA_DECIMALS, WBTC_DECIMALS } from '../constants/contracts';
import { BOND_TERM_OPTIONS } from '../constants/bondingTerms';

const useBonding = () => {
    const { address, isConnected } = useAccount();
    const [inputType, setInputType] = useState('WBTC'); // 'WBTC' hoặc 'PRANA'
    const [wbtcAmount, setWbtcAmount] = useState('');
    const [pranaAmount, setPranaAmount] = useState('');
    const [termIndex, setTermIndex] = useState(0); // Chỉ số cho BOND_TERM_OPTIONS
    const [bondRates, setBondRates] = useState({}); // Lưu trữ tỷ lệ bond { termInSeconds: rate }

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false); // Thêm state loading riêng

    const { writeContractAsync, status: writeStatus } = useWriteContract();
    const publicClient = usePublicClient();
    
    const selectedTermEnum = termIndex; // Enum trong contract thường bắt đầu từ 0

    // --- Đọc dữ liệu Contract ---

    // Đọc số dư WBTC của người dùng
    const { data: wbtcBalanceData } = useReadContract({
        address: WBTC_ADDRESS,
        abi: WBTC_ABI,
        functionName: 'balanceOf',
        args: [address],
        enabled: isConnected && !!address,
        watch: true,
    });
    const wbtcBalance = wbtcBalanceData ? formatUnits(wbtcBalanceData, WBTC_DECIMALS) : '0';

    // Đọc allowance WBTC cho contract Bond
    const { data: wbtcAllowanceData, refetch: refetchAllowance } = useReadContract({
        address: WBTC_ADDRESS,
        abi: WBTC_ABI,
        functionName: 'allowance',
        args: [address, BOND_CONTRACT_ADDRESS],
        enabled: isConnected && !!address,
        watch: true, // Theo dõi thay đổi allowance
    });
    const wbtcAllowance = wbtcAllowanceData ? BigInt(wbtcAllowanceData) : BigInt(0);

    // Đọc Min Buy Amount (tính bằng PRANA)
    const { data: minBuyAmountData } = useReadContract({
        address: BOND_CONTRACT_ADDRESS,
        abi: BOND_CONTRACT_ABI,
        functionName: 'minPranaBuyAmount',
        enabled: isConnected,
    });
    const minPranaBuyAmountFormatted = minBuyAmountData ? formatUnits(minBuyAmountData, PRANA_DECIMALS) : '0';

    // --- Tính toán ---

    // TODO: Triển khai logic gọi view function của contract để tính toán số lượng đối ứng
    // Hiện tại chưa có view function công khai trong contract đã cung cấp
    // Cần thêm calculateWbtcAmountForPrana và calculatePranaAmountForWbtc vào contract
    // Hoặc tính toán phía client (phức tạp và cần lấy reserve từ pool)
    const calculateCounterpartAmount = async () => {
        if (!isConnected) return { requiredWbtc: '0', purchasablePrana: '0' };
        // Logic tạm thời/giả định
        if (inputType === 'WBTC' && wbtcAmount) {
             // Gọi hàm view calculatePranaAmountForWbtc(wbtcAmountWei, selectedTermEnum)
             // const prana = await readContract({ ..., functionName: 'calculatePranaAmountForWbtc', args: [...]});
             // setPranaAmount(formatUnits(prana, PRANA_DECIMALS));
             setPranaAmount('...'); // Placeholder
        } else if (inputType === 'PRANA' && pranaAmount) {
             // Gọi hàm view calculateWbtcAmountForPrana(pranaAmountWei, selectedTermEnum)
             // const wbtc = await readContract({ ..., functionName: 'calculateWbtcAmountForPrana', args: [...]});
             // setWbtcAmount(formatUnits(wbtc, WBTC_DECIMALS));
             setWbtcAmount('...'); // Placeholder
        }
         return { requiredWbtc: '...', purchasablePrana: '...' }; // Placeholder
    };

    // Chạy tính toán khi input thay đổi
    useEffect(() => {
        const debounceTimeout = setTimeout(() => {
            calculateCounterpartAmount();
        }, 500); // Debounce để tránh gọi quá nhiều khi gõ
        return () => clearTimeout(debounceTimeout);
    }, [wbtcAmount, pranaAmount, inputType, termIndex, isConnected]);

    // --- Cập nhật Loading State ---
    useEffect(() => {
      setLoading(writeStatus === 'pending');
    }, [writeStatus]);

    // --- Reset messages ---
    useEffect(() => {
      if (error || success) {
        const timer = setTimeout(() => {
          setError('');
          setSuccess('');
        }, 10000); // Reset sau 10 giây
        return () => clearTimeout(timer);
      }
    }, [error, success]);

    // --- Xử lý Actions ---

    const handleApprove = async () => {
        setError('');
        setSuccess('');
        if (!wbtcAmount || isNaN(parseFloat(wbtcAmount)) || parseFloat(wbtcAmount) <= 0) {
            setError('Vui lòng nhập số lượng WBTC hợp lệ.');
            return;
        }
        setLoading(true); // Bắt đầu loading

        const amountToApprove = parseUnits(wbtcAmount, WBTC_DECIMALS);

        try {
            const hash = await writeContractAsync({ // Lấy hash từ kết quả
                address: WBTC_ADDRESS,
                abi: WBTC_ABI,
                functionName: 'approve',
                args: [BOND_CONTRACT_ADDRESS, amountToApprove],
            });
            setSuccess(`Phê duyệt thành công! Transaction: ${hash}. Vui lòng đợi xác nhận và cập nhật allowance.`);
            // Không reset form ở đây, chỉ thông báo
            // refetchAllowance sẽ tự động cập nhật khi watch=true hoặc có thể gọi thủ công nếu cần
            refetchAllowance(); // Chủ động gọi lại fetch allowance
        } catch (err) {
            console.error("Approve error:", err);
            // Xử lý lỗi tương tự useStaking.js
            let errorMsg = 'Phê duyệt thất bại';
             if (err.message?.includes('rejected') || err.message?.includes('denied')) {
               errorMsg = 'Yêu cầu phê duyệt bị từ chối';
             } else if (err.message?.includes('insufficient funds')) {
               errorMsg = 'Không đủ gas để thực hiện giao dịch';
             } else {
               errorMsg = `Phê duyệt thất bại: ${err.shortMessage || err.message || 'Lỗi không xác định'}`;
             }
            setError(errorMsg);
        } finally {
            setLoading(false); // Kết thúc loading
        }
    };

    const handleBuyBond = async () => {
        setError('');
        setSuccess('');
        setLoading(true); // Bắt đầu loading

        let finalWbtcAmountWei;
        let finalPranaAmountWei;
        let functionToCall;
        let args;

        // --- Logic kiểm tra input và xác định function/args (Giữ nguyên) ---
        if (inputType === 'WBTC') {
            if (!wbtcAmount || isNaN(parseFloat(wbtcAmount)) || parseFloat(wbtcAmount) <= 0) {
                setError('Vui lòng nhập số lượng WBTC hợp lệ.');
                setLoading(false); return;
            }
            // TODO: Add check with calculated PRANA amount vs minBuyAmountData when calculation is implemented
            // if (calculatedPranaAmountWei < minBuyAmountData) { ... }

            finalWbtcAmountWei = parseUnits(wbtcAmount, WBTC_DECIMALS);
            if (finalWbtcAmountWei > wbtcAllowance) {
                setError('Cần phê duyệt WBTC trước hoặc phê duyệt số lượng lớn hơn.');
                setLoading(false); return;
            }
            functionToCall = 'buyBondWithWbtc';
            args = [finalWbtcAmountWei, selectedTermEnum];

        } else { // inputType === 'PRANA'
            if (!pranaAmount || isNaN(parseFloat(pranaAmount)) || parseFloat(pranaAmount) <= 0) {
                setError('Vui lòng nhập số lượng PRANA hợp lệ.');
                setLoading(false); return;
            }
             finalPranaAmountWei = parseUnits(pranaAmount, PRANA_DECIMALS);
             if (minBuyAmountData && finalPranaAmountWei < minBuyAmountData) {
                setError(`Số lượng PRANA tối thiểu là ${minPranaBuyAmountFormatted}.`);
                setLoading(false); return;
            }
            // TODO: Add check for required WBTC amount vs allowance when calculation is implemented
            // finalWbtcAmountWei = parseUnits(requiredWbtc, WBTC_DECIMALS);
            // if (finalWbtcAmountWei > wbtcAllowance) { ... }

             // Tạm thời dùng wbtcAmount nhập vào để tính allowance, CẦN SỬA KHI CÓ TÍNH TOÁN
             const tempRequiredWbtcWei = parseUnits(wbtcAmount || '0', WBTC_DECIMALS);
             if (tempRequiredWbtcWei <= 0 || tempRequiredWbtcWei > wbtcAllowance) {
                 setError('Không tính được WBTC cần thiết hoặc cần phê duyệt WBTC trước.');
                 setLoading(false); return;
             }

            functionToCall = 'buyBondWithPrana';
            args = [finalPranaAmountWei, selectedTermEnum];
        }
        // --- Kết thúc logic kiểm tra ---

        try {
            const hash = await writeContractAsync({ // Lấy hash từ kết quả
                address: BOND_CONTRACT_ADDRESS,
                abi: BOND_CONTRACT_ABI,
                functionName: functionToCall,
                args: args,
            });
            setSuccess(`Mua bond thành công! Transaction: ${hash}`);
             // Reset form giống useStaking.js
            setWbtcAmount('');
            setPranaAmount('');
            // Không cần reset termIndex
            refetchAllowance(); // Fetch lại allowance (có thể đã dùng hết)
            // Có thể fetch lại danh sách bond của user ở đây nếu cần
        } catch (err) {
            console.error("Buy bond error:", err);
            // Xử lý lỗi tương tự useStaking.js
            let errorMsg = 'Mua bond thất bại';
             if (err.message?.includes('execution reverted')) {
               const revertReason = err.message.match(/execution reverted: (.*?)(?:"|$)/);
               errorMsg = revertReason ? `Lỗi hợp đồng: ${revertReason[1]}` : 'Giao dịch bị revert';
             } else if (err.message?.includes('rejected') || err.message?.includes('denied')) {
               errorMsg = 'Giao dịch bị từ chối bởi ví';
             } else if (err.message?.includes('insufficient funds')) {
               errorMsg = 'Không đủ gas để thực hiện giao dịch';
             } else {
                errorMsg = `Mua bond thất bại: ${err.shortMessage || err.message || 'Lỗi không xác định'}`;
             }
            setError(errorMsg);
        } finally {
             setLoading(false); // Kết thúc loading
        }
    };

    // --- Trạng thái Loading (đã chuyển lên trên) ---
    // const isLoading = writeStatus === 'pending'; // Sử dụng state `loading` thay thế

    const needsApproval = useMemo(() => {
        // Chỉ cần approve khi có số lượng WBTC hợp lệ và lớn hơn allowance
        // Điều này đúng cho cả hai trường hợp:
        // 1. inputType='WBTC', wbtcAmount được nhập
        // 2. inputType='PRANA', wbtcAmount được tính toán (TODO: sử dụng giá trị tính toán khi có)
        const amountToCheck = parseUnits(wbtcAmount || '0', WBTC_DECIMALS);
        return isConnected && amountToCheck > 0 && amountToCheck > wbtcAllowance;
    }, [wbtcAmount, wbtcAllowance, isConnected]);

    // Đọc tất cả Bond Rates
    useEffect(() => {
      async function fetchRates() {
        if (!isConnected) return;
        
        try {
          // Khởi tạo object lưu trữ tỷ lệ bond
          let ratesMap = {};
          
          // Nếu contract có hàm getAllBondRates() trả về [termEnums, rateValues, durationValues]
          const result = await publicClient.readContract({
            address: BOND_CONTRACT_ADDRESS,
            abi: BOND_CONTRACT_ABI,
            functionName: 'getAllBondRates'
          });
          
          // Phân tích kết quả
          const [termEnums, rateValues, durationValues] = result;
          
          // Xử lý kết quả
          for (let i = 0; i < termEnums.length; i++) {
            const termEnum = Number(termEnums[i]);
            const termOption = BOND_TERM_OPTIONS.find(term => term.id === termEnum);
            if (termOption) {
              ratesMap[termOption.seconds] = {
                rate: Number(rateValues[i]),
                duration: Number(durationValues[i]),
                discountPercent: Number(rateValues[i]) / 100
              };
            }
          }
          
          console.log('Fetched bond rates:', ratesMap);
          setBondRates(ratesMap);
        } catch (err) {
          console.error('Error fetching bond rates:', err);
          // Có thể setError nếu muốn hiển thị lỗi trên UI
        }
      }
      
      fetchRates();
      // Gọi lại khi user connect hoặc contract address thay đổi
    }, [isConnected, BOND_CONTRACT_ADDRESS]);

    return {
        address,
        isConnected,
        inputType,
        setInputType,
        wbtcAmount,
        setWbtcAmount,
        pranaAmount,
        setPranaAmount,
        termIndex,
        setTermIndex,
        bondRates, // Cần được fetch và cập nhật
        error,
        success,
        loading, // Sử dụng state loading mới
        writeStatus, // Trạng thái từ useWriteContract ('idle', 'pending', 'success', 'error')
        handleApprove,
        handleBuyBond,
        wbtcBalance,
        minPranaBuyAmountFormatted,
        needsApproval,
        // Thêm các giá trị tính toán được (khi có view function)
        // requiredWbtc,
        // purchasablePrana,
    };
};

export default useBonding;
