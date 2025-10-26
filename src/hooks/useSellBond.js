import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { SELL_BOND_ADDRESS, SELL_BOND_ABI } from '../constants/sellBondContract';
import { PRANA_ADDRESS, PRANA_ABI, PRANA_DECIMALS, WBTC_DECIMALS } from '../constants/sharedContracts';
import { BOND_TERMS } from '../constants/bondTerms';
import { calculateWbtcQuote } from '../utils/SellBondPricing';

const useSellBond = () => {
  const { address, isConnected } = useAccount();
  const [pranaAmount, setPranaAmount] = useState('');
  const [termIndex, setTermIndex] = useState(1); // Default term index
  const [bondRates, setBondRates] = useState({}); // Stores { termInSeconds: { rate, duration } }
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculatedWbtc, setCalculatedWbtc] = useState('0'); // Calculated WBTC user will receive
  const [isWaitingForApprovalConfirmation, setIsWaitingForApprovalConfirmation] = useState(false);
  const [didSyncReserves, setDidSyncReserves] = useState(false);
  const [reserveWarning, setReserveWarning] = useState('');
  const { writeContractAsync, status: writeStatus } = useWriteContract();
  const publicClient = usePublicClient();
  
  const selectedTermEnum = termIndex; // Enum in contract (matching BOND_TERMS id)
  
  // --- Contract Reads ---
  
  // Read user's PRANA balance. 'data' renamed to pranaBalanceData
  const { data: pranaBalanceData } = useReadContract({
    address: PRANA_ADDRESS,
    abi: PRANA_ABI,
    functionName: 'balanceOf',
    args: [address],
    enabled: isConnected && !!address,
    watch: true,
  });
  const pranaBalance = pranaBalanceData ? formatUnits(pranaBalanceData, PRANA_DECIMALS) : '0';
  
  // Read PRANA allowance for the Sell Bond contract
  const { data: pranaAllowanceData, refetch: refetchAllowance } = useReadContract({
    address: PRANA_ADDRESS,
    abi: PRANA_ABI,
    functionName: 'allowance',
    args: [address, SELL_BOND_ADDRESS],
    enabled: isConnected && !!address,
    watch: true,
  });
  const pranaAllowance = pranaAllowanceData ? BigInt(pranaAllowanceData) : BigInt(0);
  
  // Read Min Sell Amount (in PRANA)
  const { data: minSellAmountData } = useReadContract({
    address: SELL_BOND_ADDRESS,
    abi: SELL_BOND_ABI,
    functionName: 'minPranaSellAmount', // Adjusted function name
    enabled: isConnected,
  });
  const minPranaSellAmountFormatted = minSellAmountData ? formatUnits(minSellAmountData, PRANA_DECIMALS) : '0';
  const minPranaSellAmountWei = minSellAmountData ? BigInt(minSellAmountData) : BigInt(0);
  
  // --- Calculations ---
  
  const isValidPranaInput = useMemo(() => pranaAmount && !isNaN(parseFloat(pranaAmount)) && parseFloat(pranaAmount) > 0, [pranaAmount]);
  
  // Calculation effect - runs when PRANA input or term changes
  useEffect(() => {
    const calculateWbtc = async () => {
      if (!isConnected || !publicClient || !isValidPranaInput || !pranaAmount) {
        setCalculatedWbtc('0');
        setDidSyncReserves(false);
        setReserveWarning('');
        return; // Not ready or invalid input
      }
      
      setIsCalculating(true);
      setCalculatedWbtc('0'); // Reset
      setReserveWarning('');
      setDidSyncReserves(false);
      
      try {
        const pranaAmountWei = parseUnits(pranaAmount, PRANA_DECIMALS);
        
        if (pranaAmountWei === 0n) {
          setCalculatedWbtc('0');
          setDidSyncReserves(false);
        } else {
          const { wbtcQuote, reservesSynced, warning } = await calculateWbtcQuote({
            pranaAmountWei,
            period: selectedTermEnum,
            publicClient,
          });
          if (warning) {
            setReserveWarning(warning);
            setCalculatedWbtc('0');
            setDidSyncReserves(false);
          } else {
            const formattedWbtc = formatUnits(wbtcQuote, WBTC_DECIMALS);
            setCalculatedWbtc(formattedWbtc);
            setDidSyncReserves(reservesSynced);
            setReserveWarning('');
          }
        }
      } catch (err) {
        console.error("WBTC Calculation error:", err);
        setError("Lỗi tính toán số WBTC nhận được.");
        setCalculatedWbtc('0');
        setDidSyncReserves(false);
        setReserveWarning('');
      } finally {
        setIsCalculating(false);
      }
    };
    
    // Debounce the calculation
    const debounceTimeout = setTimeout(() => {
      calculateWbtc();
    }, 500); // 500ms debounce
    
    return () => clearTimeout(debounceTimeout);
    
  }, [pranaAmount, isConnected, publicClient, isValidPranaInput, selectedTermEnum]);
  
  
  // --- Loading State ---
  useEffect(() => {
    setLoading(writeStatus === 'pending' || isWaitingForApprovalConfirmation);
  }, [writeStatus, isWaitingForApprovalConfirmation]);
  
  // --- Reset messages ---
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 10000); // Reset after 10 seconds
      return () => clearTimeout(timer);
    }
  }, [error, success]);
  
  // --- Actions ---
  
  const handleApprove = async () => {
    setError('');
    setSuccess('');
    setIsWaitingForApprovalConfirmation(false);
    
    if (!isValidPranaInput) {
      setError('Vui lòng nhập số lượng PRANA hợp lệ để phê duyệt.');
      return;
    }
    
    const amountToApprove = parseUnits(pranaAmount, PRANA_DECIMALS);
    
    try {
      const hash = await writeContractAsync({
        address: PRANA_ADDRESS, // Approve PRANA token
        abi: PRANA_ABI,
        functionName: 'approve',
        args: [SELL_BOND_ADDRESS, amountToApprove],
      });
      setIsWaitingForApprovalConfirmation(true);
      setSuccess(`Approve transaction ${hash} sent. Waiting for confirmation...`);
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      setIsWaitingForApprovalConfirmation(false);
      
      if (receipt.status === 'success') {
        setSuccess(`Approve transaction ${hash} confirmed! Allowance updated.`);
        refetchAllowance();
      } else {
        console.error("Approve PRANA transaction failed:", receipt);
        setError(`Approve transaction ${hash} failed. Status: ${receipt.status}`);
      }
    } catch (err) {
      console.error("Approve PRANA error:", err);
      setIsWaitingForApprovalConfirmation(false);
      let errorMsg = 'Approve PRANA thất bại';
      if (err.message?.includes('rejected') || err.message?.includes('denied')) {
        errorMsg = 'Yêu cầu approve bị từ chối';
      } else if (err.message?.includes('insufficient funds')) {
        errorMsg = 'Không đủ gas để thực hiện giao dịch';
      } else {
        errorMsg = `Approve PRANA thất bại: ${err.shortMessage || err.message || 'Lỗi không xác định'}`;
      }
      setError(errorMsg);
    }
  };
  
  const handleSellBond = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    
    if (!isValidPranaInput || isCalculating) {
      setError('Vui lòng nhập số lượng PRANA hợp lệ và đợi tính toán hoàn tất.');
      setLoading(false); return;
    }
    
    const finalPranaAmountWei = parseUnits(pranaAmount, PRANA_DECIMALS);
    
    // Check minimum PRANA sell amount
    if (finalPranaAmountWei < minPranaSellAmountWei) {
      setError(`Số lượng PRANA bán tối thiểu là ${minPranaSellAmountFormatted}.`);
      setLoading(false); return;
    }
    
    // Check allowance
    if (finalPranaAmountWei > pranaAllowance) {
      setError('Cần approve PRANA trước hoặc approve số lượng lớn hơn.');
      setLoading(false); return;
    }
    
    try {
      const hash = await writeContractAsync({
        address: SELL_BOND_ADDRESS,
        abi: SELL_BOND_ABI,
        functionName: 'sellBond',
        args: [finalPranaAmountWei, selectedTermEnum],
      });
      setSuccess(`Giao dịch bán bond đã được gửi thành công! Hash: ${hash}`);
      setPranaAmount(''); // Reset input
      setCalculatedWbtc('0'); // Reset calculation
      refetchAllowance(); // Refetch allowance as it might have changed implicitly
      // TODO: Consider refetching user's bond list here
    } catch (err) {
      console.error("Sell bond error:", err);
      let errorMsg = 'Bán bond thất bại';
      // Extract revert reasons if possible
      if (err.message?.includes('execution reverted')) {
        const revertReason = err.message.match(/execution reverted: (.*?)(?:"|$)/);
        errorMsg = revertReason ? `Lỗi hợp đồng: ${revertReason[1]}` : 'Giao dịch bị revert';
      } else if (err.message?.includes('rejected') || err.message?.includes('denied')) {
        errorMsg = 'Giao dịch bị từ chối bởi ví';
      } else if (err.message?.includes('insufficient funds')) {
        errorMsg = 'Không đủ gas để thực hiện giao dịch';
      } else if (err.message?.includes('PRANA amount below minimum')) {
        errorMsg = `Lỗi: Số lượng PRANA thấp hơn mức tối thiểu (${minPranaSellAmountFormatted}).`;
      } else if (err.message?.includes('Not enough WBTC available')) {
        errorMsg = "Lỗi: Kho bạc không đủ WBTC để mua PRANA này. Thử lại sau.";
      } else {
        errorMsg = `Bán bond thất bại: ${err.shortMessage || err.message || 'Lỗi không xác định'}`;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };
  
  // --- Derived State ---
  
  const needsApproval = useMemo(() => {
    if (!isConnected || !isValidPranaInput) return false;
    const requiredPranaWei = parseUnits(pranaAmount, PRANA_DECIMALS);
    return requiredPranaWei > 0n && requiredPranaWei > pranaAllowance;
  }, [pranaAmount, pranaAllowance, isConnected, isValidPranaInput]);
  
  // Fetch Bond Rates (V2: bondRates(termId))
  useEffect(() => {
    async function fetchRates() {
      if (!isConnected || !publicClient) return;
      
      try {
        const termOptions = BOND_TERMS;
        const entries = await Promise.all(
          termOptions.map(async (option) => {
            const [rate, duration] = await publicClient.readContract({
              address: SELL_BOND_ADDRESS,
              abi: SELL_BOND_ABI,
              functionName: 'bondRates',
              args: [option.id]
            });
            
            return [option.seconds, { rate: BigInt(rate), duration: BigInt(duration) }];
          })
        );
        
        const ratesInfoMap = Object.fromEntries(entries);
        setBondRates(ratesInfoMap);
      } catch (err) {
        console.error('Error fetching sell bond rates:', err);
        setError('Lỗi khi lấy dữ liệu tỷ lệ bond (bán).');
      }
    }
    
    fetchRates();
  }, [isConnected, publicClient]);
  
  const isLoading = loading;
  
  return {
    address,
    isConnected,
    pranaAmount,
    setPranaAmount,
    termIndex,
    setTermIndex,
    bondRates,
    error,
    success,
    loading: isLoading,
    isCalculating,
    handleApprove,
    handleSellBond,
    pranaBalance,
    minPranaSellAmountFormatted,
    needsApproval,
    calculatedWbtc,
    isWaitingForApprovalConfirmation,
    isValidPranaInput,
    didSyncReserves,
    reserveWarning,
  };
};

export default useSellBond;