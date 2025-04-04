import React from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useTheme } from '../context/ThemeContext';

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
      <Box sx={{ width: '100%', padding: '20px 10px' }}>
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
            const displayValue = valueMap[option.seconds];
            return displayValue !== undefined ? `${displayValue}${valueLabelSuffix}` : '';
          }}
          disabled={disabled}
          sx={{
            '& .MuiSlider-markLabel': {
              whiteSpace: 'pre-line',
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