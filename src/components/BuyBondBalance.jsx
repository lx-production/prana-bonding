import DonutChart from './DonutChart';
import { useBuyBondBalanceData } from '../hooks/useBuyBondBalanceData';

const BuyBondBalance = () => {
  const { isLoading, error, metrics } = useBuyBondBalanceData();

  const balanceMetrics = metrics.filter((metric) => metric.key === 'balance' || metric.key === 'committed');
  const volumeMetric = metrics.find((metric) => metric.key === 'totalVolume');

  const chartData = balanceMetrics.map((metric) => ({
    label: metric.label,
    value: metric.numericValue,
    formattedValue: metric.formattedValue,
  }));

  return (
    <div className="balance-container">
      <h3 style={{ textAlign: 'center', marginBottom: '2rem' }}>Buy Bond Status</h3>
      {isLoading ? (
        <p>Loading details...</p>
      ) : error ? (
        <p className="error">Error loading contract details: {error.message || 'Unknown error'}</p>
      ) : (
        <>
          <DonutChart data={chartData} />
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

export default BuyBondBalance;