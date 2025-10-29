import { useMemo } from 'react';
import PropTypes from 'prop-types';

const DEFAULT_COLORS = ['#4f6ef2', '#61ddaa', '#f6bd16', '#7262fd'];

const createGradient = (segments, totalValue) => {
  if (totalValue <= 0) {
    return `${DEFAULT_COLORS[0]} 0% 100%`;
  }

  let currentPercentage = 0;

  return segments
    .map(({ color, value }) => {
      const segmentPercentage = (value / totalValue) * 100;
      const start = currentPercentage;
      const end = currentPercentage + segmentPercentage;
      currentPercentage = end;
      return `${color} ${start}% ${end}%`;
    })
    .join(', ');
};

const DonutChart = ({ data, size = 200, thickness = 56, totalLabel = 'Total PRANA', valueSuffix = 'PRANA' }) => {
  const prepared = useMemo(() => {
    const validData = data.map((item, index) => ({
      ...item,
      color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      value: Number.isFinite(item.value) ? Math.max(item.value, 0) : 0,
    }));

    const totalValue = validData.reduce((sum, item) => sum + item.value, 0);
    const gradient = createGradient(validData, totalValue);

    return {
      segments: validData,
      totalValue,
      gradient,
    };
  }, [data]);

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
      }),
    [],
  );

  return (
    <div className="donut-chart">
      <div
        className="donut-chart__graphic"
        style={{
          width: size,
          height: size,
          maxWidth: '100%',
          maxHeight: '100%',
          background: `conic-gradient(${prepared.gradient})`,
        }}
      >
        <div
          className="donut-chart__center"
          style={{
            width: size - thickness,
            height: size - thickness,
          }}
        >
          <span className="donut-chart__center-value">
            {prepared.totalValue > 0 ? numberFormatter.format(prepared.totalValue) : '0'}
          </span>
          <span className="donut-chart__center-label">{totalLabel}</span>
        </div>
      </div>
      <ul className="donut-chart__legend">
        {prepared.segments.map(({ label, formattedValue, color }) => (
          <li key={label} className="donut-chart__legend-item">
            <span
              className="donut-chart__legend-swatch"
              style={{ backgroundColor: color }}
            />
            <div className="donut-chart__legend-text">
              <span className="donut-chart__legend-label">{label}</span>
              <span className="donut-chart__legend-value">{formattedValue} {valueSuffix}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

DonutChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
      formattedValue: PropTypes.string.isRequired,
      color: PropTypes.string,
    }),
  ).isRequired,
  size: PropTypes.number,
  thickness: PropTypes.number,
  totalLabel: PropTypes.string,
  valueSuffix: PropTypes.string,
};

export default DonutChart;
