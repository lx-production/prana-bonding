import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { BOND_CONTRACT_ADDRESS, BOND_CONTRACT_ABI } from '../constants/bondingContracts';
import { WBTC_ADDRESS, WBTC_ABI, WBTC_DECIMALS, PRANA_DECIMALS } from '../constants/sharedContracts';
import { BOND_TERM_OPTIONS } from '../constants/bondingTerms';
import { calculatePranaAmount, calculateWbtcAmount } from '../utils/UniswapV3Helper';

// Helper function to get rate (in basis points) from termIndex
const getRateForTerm = (termIndex, bondRatesMap, termOptions) => {
    const selectedOption = termOptions[termIndex];
    if (!selectedOption) return 0n;
    const rateInfo = bondRatesMap[selectedOption.seconds];
    // Ensure rate is treated as BigInt
    return rateInfo ? BigInt(rateInfo.rate) : 0n;
};

const useBonding = () => {
    const { address, isConnected } = useAccount();
    const [inputType, setInputType] = useState('WBTC'); // 'WBTC' hoặc 'PRANA'
    const [wbtcAmount, setWbtcAmount] = useState('');
    const [pranaAmount, setPranaAmount] = useState('');
    const [termIndex, setTermIndex] = useState(0); // Chỉ số cho BOND_TERM_OPTIONS
    const [bondRates, setBondRates] = useState({}); // Lưu trữ tỷ lệ bond { termInSeconds: rate }
    const [uniswapPoolAddress, setUniswapPoolAddress] = useState(null);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false); // Thêm state loading riêng
    const [isCalculating, setIsCalculating] = useState(false); // For price calculation
    const [calculatedPrana, setCalculatedPrana] = useState('0'); // Calculated PRANA for WBTC input
    const [calculatedWbtc, setCalculatedWbtc] = useState('0'); // Calculated WBTC for PRANA input

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
    const minPranaBuyAmountWei = minBuyAmountData ? BigInt(minBuyAmountData) : BigInt(0);

    // Read the Uniswap V3 Pool address used by the bonding contract
    useReadContract({
        address: BOND_CONTRACT_ADDRESS,
        abi: BOND_CONTRACT_ABI, // Make sure ABI includes 'uniswapV3PoolAddress'
        functionName: 'uniswapV3PoolAddress',
        enabled: isConnected,
        onSuccess: (data) => {
            if (data && data !== '0x0000000000000000000000000000000000000000') {
                setUniswapPoolAddress(data);
                // console.log("Uniswap Pool Address:", data);
            } else {
                console.error("Failed to get valid Uniswap Pool Address from Bonding contract.");
                setError("Lỗi cấu hình: Không tìm thấy địa chỉ pool Uniswap.");
            }
        },
        onError: (err) => {
            console.error("Error fetching uniswapPoolAddress:", err);
            setError("Không thể đọc địa chỉ pool Uniswap từ hợp đồng.");
        }
    });

    // --- Tính toán ---

    // --- Calculations (Client-side) ---

    const isValidWbtcInput = useMemo(() => wbtcAmount && !isNaN(parseFloat(wbtcAmount)) && parseFloat(wbtcAmount) > 0, [wbtcAmount]);
    const isValidPranaInput = useMemo(() => pranaAmount && !isNaN(parseFloat(pranaAmount)) && parseFloat(pranaAmount) > 0, [pranaAmount]);

    // Calculation effect - runs when inputs change
    useEffect(() => {
        const calculateAmounts = async () => {
            if (!isConnected || !uniswapPoolAddress || Object.keys(bondRates).length === 0 || !publicClient) {
                setCalculatedPrana('0');
                setCalculatedWbtc('0');
                return; // Not ready yet
            }

            setIsCalculating(true);
            setCalculatedPrana('0'); // Reset previous calculations
            setCalculatedWbtc('0');

            try {
                // Lấy rate cho term đã chọn
                const rate = getRateForTerm(termIndex, bondRates, BOND_TERM_OPTIONS);
                if (rate < 0n) throw new Error("Invalid term index or rate"); // Should be >= 0
    
                if (inputType === 'WBTC' && isValidWbtcInput) {
                    const wbtcAmountWei = parseUnits(wbtcAmount, WBTC_DECIMALS);
                    
                    // Sử dụng calculatePranaAmount từ UniswapV3Helper
                    const calculatedPranaWei = await calculatePranaAmount(
                        wbtcAmountWei,
                        termIndex,
                        bondRates,
                        publicClient,
                        uniswapPoolAddress
                    );
                    
                    setCalculatedPrana(formatUnits(calculatedPranaWei, PRANA_DECIMALS));
                } else if (inputType === 'PRANA' && isValidPranaInput) {
                    const pranaAmountWei = parseUnits(pranaAmount, PRANA_DECIMALS);
                    
                    // Sử dụng calculateWbtcAmount từ UniswapV3Helper
                    const finalWbtcAmount = await calculateWbtcAmount(
                        pranaAmountWei,
                        termIndex,
                        bondRates,
                        publicClient,
                        uniswapPoolAddress
                    );
                    
                    setCalculatedWbtc(formatUnits(finalWbtcAmount, WBTC_DECIMALS));
                }
            } catch (err) {
                console.error("Calculation error:", err);
                // Optionally set an error state specific to calculation
                // setError("Lỗi tính toán giá trị.");
                setCalculatedPrana('0');
                setCalculatedWbtc('0');
            } finally {
                setIsCalculating(false);
            }
        };

        // Debounce the calculation
        const debounceTimeout = setTimeout(() => {
            calculateAmounts();
        }, 500); // 500ms debounce

        return () => clearTimeout(debounceTimeout);

    }, [
        wbtcAmount, pranaAmount, inputType, termIndex, isConnected, uniswapPoolAddress,
        bondRates, publicClient, isValidWbtcInput, isValidPranaInput // Dependencies
    ]);

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
        // Use calculated WBTC if PRANA is the input type, otherwise use direct WBTC input
        const wbtcToApproveStr = inputType === 'PRANA' ? calculatedWbtc : wbtcAmount;

        if (!wbtcToApproveStr || isNaN(parseFloat(wbtcToApproveStr)) || parseFloat(wbtcToApproveStr) <= 0) {
            setError('Không thể xác định số lượng WBTC để phê duyệt.');
            return;
        }
        setLoading(true);

        const amountToApprove = parseUnits(wbtcToApproveStr, WBTC_DECIMALS);

        try {
            const hash = await writeContractAsync({ // Lấy hash từ kết quả
                address: WBTC_ADDRESS,
                abi: WBTC_ABI,
                functionName: 'approve',
                args: [BOND_CONTRACT_ADDRESS, amountToApprove],
            });
            setSuccess(`Phê duyệt thành công! Transaction: ${hash}. Vui lòng đợi giao dịch xác nhận.`);
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

        let functionToCall;
        let args;
        let finalWbtcAmountWei;
        let finalPranaAmountWei;

        // --- Determine function and arguments based on input type ---
        if (inputType === 'WBTC') {
            if (!isValidWbtcInput || isCalculating) { // Also check calculation isn't running
                setError('Vui lòng nhập số lượng WBTC hợp lệ và đợi tính toán hoàn tất.');
                setLoading(false); return;
            }
            finalWbtcAmountWei = parseUnits(wbtcAmount, WBTC_DECIMALS);
            // Use the state value for calculated PRANA
            const calculatedPranaWei = parseUnits(calculatedPrana || '0', PRANA_DECIMALS);

            // Check allowance
            if (finalWbtcAmountWei > wbtcAllowance) {
                setError('Cần phê duyệt WBTC trước hoặc phê duyệt số lượng lớn hơn.');
                setLoading(false); return;
            }
            // Check minimum PRANA buy amount based on client-side calculation
             if (calculatedPranaWei < minPranaBuyAmountWei) {
                 setError(`Số lượng PRANA ước tính (${formatUnits(calculatedPranaWei, PRANA_DECIMALS)}) thấp hơn mức tối thiểu (${minPranaBuyAmountFormatted}).`);
                 setLoading(false); return;
             }

            functionToCall = 'buyBondWithWbtc';
            args = [finalWbtcAmountWei, selectedTermEnum];

        } else { // inputType === 'PRANA'
            if (!isValidPranaInput || isCalculating) {
                setError('Vui lòng nhập số lượng PRANA hợp lệ và đợi tính toán hoàn tất.');
                setLoading(false); return;
            }
            finalPranaAmountWei = parseUnits(pranaAmount, PRANA_DECIMALS);
            // Use the state value for calculated WBTC
            finalWbtcAmountWei = parseUnits(calculatedWbtc || '0', WBTC_DECIMALS);

            // Check minimum PRANA buy amount directly
            if (finalPranaAmountWei < minPranaBuyAmountWei) {
                setError(`Số lượng PRANA tối thiểu là ${minPranaBuyAmountFormatted}.`);
                setLoading(false); return;
            }
            // Check allowance using client-side calculated WBTC
            if (finalWbtcAmountWei <= 0n) {
                 setError('Không tính được số lượng WBTC cần thiết.');
                 setLoading(false); return;
            }
            if (finalWbtcAmountWei > wbtcAllowance) {
                 setError(`Cần phê duyệt ít nhất ${formatUnits(finalWbtcAmountWei, WBTC_DECIMALS)} WBTC.`);
                 setLoading(false); return;
            }

            functionToCall = 'buyBondWithPrana';
            args = [finalPranaAmountWei, selectedTermEnum];
        }
        // --- End determination ---

        try {
            const hash = await writeContractAsync({ // Lấy hash từ kết quả
                address: BOND_CONTRACT_ADDRESS,
                abi: BOND_CONTRACT_ABI,
                functionName: functionToCall,
                args: args,
            });
            setSuccess(`Gửi giao dịch mua bond thành công! Hash: ${hash}`);
            setWbtcAmount('');
            setPranaAmount('');
            setCalculatedPrana('0'); // Reset calculated values
            setCalculatedWbtc('0');
            refetchAllowance(); // Refetch allowance
            // TODO: Consider refetching user's bond list here
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
             } else if (err.message?.includes('PRANA amount below minimum')) {
                 errorMsg = `Lỗi: Số lượng PRANA thấp hơn mức tối thiểu (${minPranaBuyAmountFormatted}). Giao dịch bị revert.`;
             } else if (err.message?.includes('Not enough PRANA available')) {
                 errorMsg = "Lỗi: Kho bạc không đủ PRANA để bán. Giao dịch bị revert.";
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
        let requiredWbtcWei = 0n;
        if (inputType === 'WBTC' && isValidWbtcInput) {
            requiredWbtcWei = parseUnits(wbtcAmount, WBTC_DECIMALS);
        } else if (inputType === 'PRANA' && isValidPranaInput) {
            // Use calculated WBTC state
             requiredWbtcWei = parseUnits(calculatedWbtc || '0', WBTC_DECIMALS);
        }
        // Ensure allowance is also a BigInt for comparison
        return isConnected && requiredWbtcWei > 0n && requiredWbtcWei > wbtcAllowance;
    }, [inputType, wbtcAmount, pranaAmount, calculatedWbtc, wbtcAllowance, isConnected, isValidWbtcInput, isValidPranaInput]);

    // Đọc tất cả Bond Rates
    useEffect(() => {
      async function fetchRates() {
        if (!isConnected || !publicClient) return;
        
        try {
          // Khởi tạo object lưu trữ tỷ lệ bond (chỉ phần trăm chiết khấu)
          let ratesDiscountMap = {}; // Changed variable name for clarity
          
          const result = await publicClient.readContract({
            address: BOND_CONTRACT_ADDRESS,
            abi: BOND_CONTRACT_ABI,
            functionName: 'getAllBondRates'
          });
          
          const [termEnums, rateValues] = result;
          
          for (let i = 0; i < termEnums.length; i++) {
            const termEnum = Number(termEnums[i]);
            const termOption = BOND_TERM_OPTIONS.find(term => term.id === termEnum); 
            if (termOption) {
              // Chỉ lưu trữ phần trăm chiết khấu với key là seconds
              ratesDiscountMap[termOption.seconds] = Number(rateValues[i]) / 100; 
            }
          }
          
          console.log('Fetched bond discount rates:', ratesDiscountMap);
          setBondRates(ratesDiscountMap); // Set the simplified map to state
        } catch (err) {
          console.error('Error fetching bond rates:', err);
        }
      }
      
      fetchRates();
    }, [isConnected, BOND_CONTRACT_ADDRESS, publicClient]); // Added publicClient dependency

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
        bondRates,
        error,
        success,
        loading,
        isCalculating, // Calculation loading
        writeStatus,
        handleApprove,
        handleBuyBond,
        wbtcBalance,
        minPranaBuyAmountFormatted,
        needsApproval,
        // Expose calculated values from state
        calculatedPranaForWbtc: calculatedPrana, // Renamed state variable for clarity
        calculatedWbtcForPrana: calculatedWbtc,  // Renamed state variable for clarity
    };
};

export default useBonding;
