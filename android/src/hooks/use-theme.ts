import { Colors } from '../constants/theme';
import { useColorScheme } from './use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  const activeTheme = scheme === 'dark' ? 'dark' : 'light';
  return Colors[activeTheme];
}
