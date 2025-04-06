// src/constants/bondTerms.js

// Enum BondTerm trong contract: WEEK, MONTH, QUARTER, HALF, YEAR (tương ứng index 0, 1, 2, 3, 4)
// Durations theo contract: 7, 30, 90, 180, 365 ngày

const SECONDS_PER_DAY = 86400;

export const BOND_TERMS = [
  {
    id: 0, // Tương ứng BondTerm.WEEK
    label: "7 Ngày",
    seconds: 7 * SECONDS_PER_DAY,
  },
  {
    id: 1, // Tương ứng BondTerm.MONTH
    label: "1 Tháng",
    seconds: 30 * SECONDS_PER_DAY,
  },
  {
    id: 2, // Tương ứng BondTerm.QUARTER
    label: "3 Tháng",
    seconds: 90 * SECONDS_PER_DAY,
  },
  {
    id: 3, // Tương ứng BondTerm.HALF
    label: "6 Tháng",
    seconds: 180 * SECONDS_PER_DAY,
  },
  {
    id: 4, // Tương ứng BondTerm.YEAR
    label: "1 Năm",
    seconds: 365 * SECONDS_PER_DAY,
  },
];