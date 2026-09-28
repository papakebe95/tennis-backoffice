import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// PrimeNG theme aligned with styles/_tokens.scss (same primary scale).
export const TennisPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#effaf3',
      100: '#d8f3e1',
      200: '#b4e6c7',
      300: '#82d2a5',
      400: '#4fb67f',
      500: '#2d9a63',
      600: '#1f7c4f',
      700: '#1a6342',
      800: '#174f37',
      900: '#14412e',
      950: '#0a241a',
    },
    formField: {
      borderRadius: '8px',
    },
  },
});
