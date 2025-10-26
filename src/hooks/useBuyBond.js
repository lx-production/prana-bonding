import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { BUY_BOND_ADDRESS, BUY_BOND_ABI } from '../constants/buyBondContract';
import { WBTC_ADDRESS, WBTC_ABI, WBTC_DECIMALS, PRANA_DECIMALS } from '../constants/sharedContracts';
import { BOND_TERMS } from '../constants/bondTerms';
import { calculateWbtcQuote, calculatePranaQuote } from '../utils/BuyBondPricing';

const useBuyBond = () => {
    const { address, isConnected } = useAccount();
    const [inputType, setInputType] = useState('PRANA');
    const [wbtcAmount, setWbtcAmount] = useState('');
    const [pranaAmount, setPranaAmount] = useState('');
    const [termIndex, setTermIndex] = useState(1); // Index in BOND_TERMS
    const [bondRates, setBondRates] = useState({}); // Lưu trữ tỷ lệ bond { termInSeconds: rate }
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false); // Thêm state loading riêng
    const [isCalculating, setIsCalculating] = useState(false); // For price calculation
    const [calculatedPrana, setCalculatedPrana] = useState('0'); // Calculated PRANA for WBTC input
    const [calculatedWbtc, setCalculatedWbtc] = useState('0'); // Calculated WBTC for PRANA input
    const [approveTxHash, setApproveTxHash] = useState(null); // State to store the tx hash
    const [isWaitingForApprovalConfirmation, setIsWaitingForApprovalConfirmation] = useState(false);
    const [didSyncReservesFromWbtc, setDidSyncReservesFromWbtc] = useState(false);
    const [didSyncReservesFromPrana, setDidSyncReservesFromPrana] = useState(false);

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
        args: [address, BUY_BOND_ADDRESS],
        enabled: isConnected && !!address,
        watch: true, // Theo dõi thay đổi allowance
    });
    const wbtcAllowance = wbtcAllowanceData ? BigInt(wbtcAllowanceData) : BigInt(0);

    // Đọc Min Buy Amount (tính bằng PRANA)
    const { data: minBuyAmountData } = useReadContract({
        address: BUY_BOND_ADDRESS,
        abi: BUY_BOND_ABI,
        functionName: 'minPranaBuyAmount',
        enabled: isConnected,
    });
    const minPranaBuyAmountFormatted = minBuyAmountData ? formatUnits(minBuyAmountData, PRANA_DECIMALS) : '0';
    const minPranaBuyAmountWei = minBuyAmountData ? BigInt(minBuyAmountData) : BigInt(0);    

    // --- Calculations (Client-side) ---

    const isValidWbtcInput = useMemo(() => wbtcAmount && !isNaN(parseFloat(wbtcAmount)) && parseFloat(wbtcAmount) > 0, [wbtcAmount]);
    const isValidPranaInput = useMemo(() => pranaAmount && !isNaN(parseFloat(pranaAmount)) && parseFloat(pranaAmount) > 0, [pranaAmount]);

    // Calculation effect - runs when inputs change
    useEffect(() => {
        const calculateAmounts = async () => {
            // Check if we have all required dependencies
            if (!isConnected || !publicClient) {
                setCalculatedPrana('0');
                setCalculatedWbtc('0');
                setDidSyncReservesFromWbtc(false);
                setDidSyncReservesFromPrana(false);
                return; // Not ready yet
            }
            
            setIsCalculating(true);
            setCalculatedPrana('0'); // Reset previous calculations
            setCalculatedWbtc('0');
            setDidSyncReservesFromWbtc(false);
            setDidSyncReservesFromPrana(false);

            try {
                if (inputType === 'WBTC' && isValidWbtcInput) {
                    const wbtcAmountWei = parseUnits(wbtcAmount, WBTC_DECIMALS);

                    if (wbtcAmountWei === 0n) {
                        setCalculatedPrana('0');
                        setDidSyncReservesFromWbtc(false);
                    } else {
                        const { pranaQuote, reservesSynced } = await calculatePranaQuote({
                            wbtcAmountWei,
                            period: selectedTermEnum,
                            publicClient
                        });

                        const formattedPrana = formatUnits(pranaQuote, PRANA_DECIMALS);
                        setCalculatedPrana(formattedPrana);
                        setDidSyncReservesFromWbtc(reservesSynced);
                    }

                } else if (inputType === 'PRANA' && isValidPranaInput) {
                    const pranaAmountWei = parseUnits(pranaAmount, PRANA_DECIMALS);

                    if (pranaAmountWei === 0n) {
                        setCalculatedWbtc('0');
                        setDidSyncReservesFromPrana(false);
                    } else {
                        const { wbtcQuote, reservesSynced } = await calculateWbtcQuote({
                            pranaAmountWei,
                            period: selectedTermEnum,
                            publicClient
                        });

                    const formattedWbtc = formatUnits(wbtcQuote, WBTC_DECIMALS);
                    setCalculatedWbtc(formattedWbtc);
                    setDidSyncReservesFromPrana(reservesSynced);
                    }
                } else {
                    setCalculatedPrana('0');
                    setCalculatedWbtc('0');
                    setDidSyncReservesFromWbtc(false);
                    setDidSyncReservesFromPrana(false);
                }
            } catch (err) {
                console.error("Calculation error:", err);
                setCalculatedPrana('0');
                setCalculatedWbtc('0');
                setDidSyncReservesFromWbtc(false);
                setDidSyncReservesFromPrana(false);
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
        wbtcAmount, pranaAmount, inputType, termIndex, isConnected, 
        publicClient, isValidWbtcInput, isValidPranaInput, selectedTermEnum // Updated dependencies
    ]);

    // --- Cập nhật Loading State ---
    useEffect(() => {
      setLoading(writeStatus === 'pending' || isWaitingForApprovalConfirmation);
    }, [writeStatus, isWaitingForApprovalConfirmation]);

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
        setApproveTxHash(null); // Reset previous hash
        setIsWaitingForApprovalConfirmation(false); // Reset waiting state

        const wbtcToApproveStr = inputType === 'PRANA' ? calculatedWbtc : wbtcAmount;
        if (!wbtcToApproveStr || isNaN(parseFloat(wbtcToApproveStr)) || parseFloat(wbtcToApproveStr) <= 0) {
            setError('Không thể xác định số lượng WBTC để phê duyệt.');
            return;
        }
        // setLoading(true); // Loading is now handled by the useEffect

        const amountToApprove = parseUnits(wbtcToApproveStr, WBTC_DECIMALS);

        try {
            const hash = await writeContractAsync({
                address: WBTC_ADDRESS,
                abi: WBTC_ABI,
                functionName: 'approve',
                args: [BUY_BOND_ADDRESS, amountToApprove],
            });
            setApproveTxHash(hash); // Store the hash
            setIsWaitingForApprovalConfirmation(true); // Start waiting
            setSuccess(`Approve transaction ${hash} sent. Waiting for confirmation...`);

            // Wait for the transaction receipt
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            setIsWaitingForApprovalConfirmation(false); // Stop waiting

            if (receipt.status === 'success') {
                setSuccess(`Approve transaction ${hash} confirmed! Allowance updated.`);
                refetchAllowance(); // Refetch AFTER confirmation
            } else {
                console.error("Approve transaction failed:", receipt);
                setError(`Approve transaction ${hash} failed. Status: ${receipt.status}`);
            }

        } catch (err) {
            console.error("Approve error:", err);
            setIsWaitingForApprovalConfirmation(false); // Ensure waiting state is reset on error
            let errorMsg = 'Approve failed';
            if (err.message?.includes('rejected') || err.message?.includes('denied')) {
                errorMsg = 'Approval request rejected';
            } else if (err.message?.includes('insufficient funds')) {
                errorMsg = 'Insufficient funds for gas';
            } else {
                errorMsg = `Approve failed: ${err.shortMessage || err.message || 'Unknown error'}`;
            }
            setError(errorMsg);
        } finally {
           // setLoading(false); // Loading is handled by the useEffect
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

            functionToCall = 'buyBondForWbtcAmount';
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

            functionToCall = 'buyBondForPranaAmount';
            args = [finalPranaAmountWei, selectedTermEnum];
        }
        // --- End determination ---

        try {
            const hash = await writeContractAsync({ // Lấy hash từ kết quả
                address: BUY_BOND_ADDRESS,
                abi: BUY_BOND_ABI,
                functionName: functionToCall,
                args: args,
            });
            setSuccess(`Giao dịch mua bond đã được gửi thành công! Hash: ${hash}`);
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
                 errorMsg = "Lỗi: Kho bạc không đủ PRANA để bán. Giao dịch thất bại.";
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
    }, [inputType, wbtcAmount, calculatedWbtc, wbtcAllowance, isConnected, isValidWbtcInput, isValidPranaInput]);

    // Đọc tất cả Bond Rates cho V2 bằng cách gọi bondRates(enum)
    useEffect(() => {
      async function fetchRates() {
        if (!isConnected || !publicClient) return;

        try {
          const termOptions = BOND_TERMS;
          const entries = await Promise.all(
            termOptions.map(async (option) => {
              const [rate, duration] = await publicClient.readContract({
                address: BUY_BOND_ADDRESS,
                abi: BUY_BOND_ABI,
                functionName: 'bondRates',
                args: [option.id]
              });

              return [option.seconds, { rate: BigInt(rate), duration: BigInt(duration) }];
            })
          );

          const ratesInfoMap = Object.fromEntries(entries);
          setBondRates(ratesInfoMap);
        } catch (err) {
          console.error('Error fetching bond rates:', err);
          setError('Lỗi khi lấy dữ liệu tỷ lệ bond.');
        }
      }

      fetchRates();
    }, [isConnected, publicClient]);

    // Optionally adjust the overall loading state if needed
    const isLoading = loading; // Or customize further if needed

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
        loading: isLoading, // Use the derived loading state
        isCalculating,
        writeStatus,
        handleApprove,
        handleBuyBond,
        wbtcBalance,
        minPranaBuyAmountFormatted,
        needsApproval,
        calculatedPranaForWbtc: calculatedPrana,
        calculatedWbtcForPrana: calculatedWbtc,
        approveTxHash,
        isWaitingForApprovalConfirmation,
        isValidWbtcInput,
        isValidPranaInput,
        didSyncReservesFromWbtc,
        didSyncReservesFromPrana,
    };
};

export default useBuyBond;
