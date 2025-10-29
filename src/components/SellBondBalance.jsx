import DonutChart from './DonutChart';
import { useSellBondBalanceData } from '../hooks/useSellBondBalanceData';

const SellBondBalance = () => {
  const { isLoading, error, metrics } = useSellBondBalanceData();

  const balanceMetrics = metrics.filter((metric) => metric.key === 'balance' || metric.key === 'committed');
  const volumeMetric = metrics.find((metric) => metric.key === 'totalVolume');

  const chartData = balanceMetrics.map((metric) => ({
    label: metric.label,
    value: metric.numericValue,
    formattedValue: metric.formattedValue,
  }));

  return (
    <div className="balance-container">
      <h3 style={{ textAlign: 'center', marginBottom: '2rem' }}>Sell Bond Status</h3>
      {isLoading ? (
        <p>Loading details...</p>
      ) : error ? (
        <p className="error">Error loading contract details: {error.message || 'Unknown error'}</p>
      ) : (
        <>
          <DonutChart data={chartData} totalLabel="Total SAT" valueSuffix="SAT" />
          {volumeMetric ? (
            <p style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              Total Volume: <span className="balance">{volumeMetric.formattedValue}</span>{' '}
              <span className="token-symbol">PRANA</span>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};

export default SellBondBalance;