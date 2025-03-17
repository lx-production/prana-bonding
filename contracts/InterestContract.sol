// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Add interface to access StakingContract's function
interface IStakingContract {
    function totalInterestNeeded() view external returns (uint256);
}

contract PranaInterestContract is Ownable {
    using SafeERC20 for IERC20;  // Added SafeERC20
    
    IERC20 public immutable PRANA;              // PRANA token
    address public PranaStakingContract;        // Address of the StakingContract
    bool public stakingContractSet = false;     // Flag to ensure single setting

    event StakingContractSet(address indexed stakingContract);
    event InterestPaid(address indexed user, uint256 amount);
    event ExcessWithdrawn(address indexed owner, uint256 amount);

    constructor(address _prana) Ownable(msg.sender) {
        PRANA = IERC20(_prana);
    }

    // Called after the StakingContract is deployed
    function setStakingContract(address _stakingContract) external onlyOwner {
        require(!stakingContractSet, "Staking contract already set");
        require(_stakingContract != address(0), "Invalid staking contract address");
        PranaStakingContract = _stakingContract;
        stakingContractSet = true;
        emit StakingContractSet(_stakingContract);
    }

    modifier onlyStakingContract() {
        require(msg.sender == PranaStakingContract, "Only staking contract allowed");
        require(stakingContractSet, "Staking contract not set");
        _;
    }

    function payInterest(address user, uint256 amount) external onlyStakingContract {
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Interest amount must be greater than 0");
        require(PRANA.balanceOf(address(this)) >= amount, "Insufficient funds for interest payment");
        
        // Use safeTransfer instead of transfer
        PRANA.safeTransfer(user, amount);
        emit InterestPaid(user, amount);
    }    
    
    function getWithdrawableAmount() public view returns (uint256) {
        require(PranaStakingContract != address(0), "Staking contract not set");
        
        // Get total interest needed for all stakes
        uint256 neededAmount = IStakingContract(PranaStakingContract).totalInterestNeeded();
        
        // Get current balance
        uint256 currentBalance = PRANA.balanceOf(address(this));
        
        // Calculate and return maximum withdrawable amount
        return currentBalance > neededAmount ? currentBalance - neededAmount : 0;
    }

    function withdrawExcessTokens(uint256 amount) external onlyOwner {
        uint256 excessAmount = getWithdrawableAmount();
        require(amount <= excessAmount, "Amount exceeds withdrawable balance");
        
        // Transfer excess tokens to owner using safeTransfer
        PRANA.safeTransfer(msg.sender, amount);
        emit ExcessWithdrawn(msg.sender, amount);
    }
}