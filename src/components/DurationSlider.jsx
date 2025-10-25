import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useTheme } from '../context';

// Create theme-specific Material UI themes
const createMuiTheme = (mode) => {
  return createTheme({
    palette: {
      mode: mode,
      primary: {
        main: mode === 'dark' ? '#4f6ef2' : '#0e3be0',
      },
    },
  });
};

const DurationSlider = ({
  selectedIndex,
  setSelectedIndex,
  options,
  valueMap,
  valueLabelSuffix = '% APR',
  disabled,
  labelId
}) => {
  // Get current theme from our ThemeContext
  const { theme } = useTheme();
  
  // Select the appropriate MUI theme based on our app's theme
  const muiTheme = createMuiTheme(theme === 'dark' ? 'dark' : 'light');
  
  return (
    <ThemeProvider theme={muiTheme}>
      <Box sx={{ width: '100%', padding: '20px 10px', marginTop: '30px' }}>
        <Slider
          aria-labelledby={labelId}
          aria-label="Select Option"
          value={selectedIndex}
          onChange={(_, newValue) => setSelectedIndex(Number(newValue))}
          step={null}
          marks={options.map((option, index) => ({
            value: index,
            label: option.label
          }))}
          min={0}
          max={options.length - 1}
          valueLabelDisplay="on"
          valueLabelFormat={(value) => {
            const option = options[value];
            if (!option) return ''; // Handle case where option might not exist yet

            // Look up the term info object using seconds as the key
            const termInfo = valueMap[option.seconds];

            // Check if termInfo and its rate property exist
            if (termInfo && typeof termInfo.rate !== 'undefined') {
              // Convert basis points (BigInt) to percentage (Number)
              const percentage = Number(termInfo.rate) / 100;
              // Format to 2 decimal places, adjust as needed
              return `${percentage.toFixed(2)}${valueLabelSuffix}`;
            }
            
            // Return empty string or a placeholder if data isn't ready
            return '...'; 
          }}
          disabled={disabled}
          sx={{
            '& .MuiSlider-markLabel': {
              whiteSpace: 'nowrap',
              textAlign: 'center',
            },
            '.MuiSlider-valueLabel': {
              backgroundColor: 'primary.main',
            }
          }}
        />
      </Box>
    </ThemeProvider>
  );
};

export default DurationSlider; 

DurationSlider.propTypes = {
  selectedIndex: PropTypes.number.isRequired,
  setSelectedIndex: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      seconds: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ).isRequired,
  valueMap: PropTypes.objectOf(
    PropTypes.shape({
      rate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ).isRequired,
  valueLabelSuffix: PropTypes.string,
  disabled: PropTypes.bool,
  labelId: PropTypes.string.isRequired,
};