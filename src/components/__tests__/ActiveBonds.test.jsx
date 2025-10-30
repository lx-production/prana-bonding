import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ActiveBonds from '../ActiveBonds';

const mocks = vi.hoisted(() => ({
  useAccount: vi.fn(),
  useReadContract: vi.fn(),
  useActiveBuyBonds: vi.fn(),
  useActiveSellBonds: vi.fn(),
}));

const {
  useAccount: mockUseAccount,
  useReadContract: mockUseReadContract,
  useActiveBuyBonds: mockUseActiveBuyBonds,
  useActiveSellBonds: mockUseActiveSellBonds,
} = mocks;

vi.mock('wagmi', () => ({
  useAccount: mocks.useAccount,
  useReadContract: mocks.useReadContract,
}));

vi.mock('../../hooks/useActiveBuyBonds', () => ({
  __esModule: true,
  default: mocks.useActiveBuyBonds,
}));

vi.mock('../../hooks/useActiveSellBonds', () => ({
  __esModule: true,
  default: mocks.useActiveSellBonds,
}));

const baseBuyBond = {
  id: 1,
  status: 'Vesting',
  wbtcAmountFormatted: '0.10',
  pranaAmountFormatted: '100.00',
  creationTimeFormatted: '01/01/2024 00:00',
  maturityTimeFormatted: '01/02/2024 00:00',
  claimedPranaFormatted: '10.00',
  claimablePranaFormatted: '5.00',
  progress: 50,
  canClaim: true,
};

const createBuyHookResponse = (bondOverrides = {}, actionLoading = { bondId: null }) => ({
  processedBuyBonds: [Object.assign({}, baseBuyBond, bondOverrides)],
  handleBuyClaim: vi.fn(),
  actionLoading,
  error: '',
  success: '',
});

const createSellHookResponse = (overrides = {}) => ({
  processedSellBonds: [],
  handleSellClaim: vi.fn(),
  actionLoading: { bondId: null },
  error: '',
  success: '',
  ...overrides,
});

beforeEach(() => {
  mockUseAccount.mockReturnValue({
    address: '0x123',
    isConnected: true,
  });
  mockUseReadContract.mockReturnValue({
    data: null,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ActiveBonds', () => {
  it('renders separate cards for bonds that share an on-chain id but differ by version', () => {
    mockUseActiveBuyBonds
      .mockReturnValueOnce(createBuyHookResponse({ version: 'v2' }))
      .mockReturnValueOnce(createBuyHookResponse({ version: 'v1' }));

    mockUseActiveSellBonds
      .mockReturnValueOnce(createSellHookResponse())
      .mockReturnValueOnce(createSellHookResponse());

    render(<ActiveBonds />);

    expect(screen.getAllByText('Bond #1')).toHaveLength(2);
    expect(screen.getByText('V2')).toBeInTheDocument();
    expect(screen.getByText('V1')).toBeInTheDocument();
  });

  it('only marks the matching version/id pair as loading when an action is in progress', () => {
    mockUseActiveBuyBonds
      .mockReturnValueOnce(createBuyHookResponse({ version: 'v2' }))
      .mockReturnValueOnce(createBuyHookResponse({ version: 'v1' }, { bondId: 1 }));

    mockUseActiveSellBonds
      .mockReturnValueOnce(createSellHookResponse())
      .mockReturnValueOnce(createSellHookResponse());

    render(<ActiveBonds />);

    const loadingButton = screen.getByRole('button', { name: 'Claiming...' });
    expect(loadingButton).toBeDisabled();

    const activeButton = screen.getByRole('button', { name: 'Claim PRANA' });
    expect(activeButton).not.toBeDisabled();
  });
});
