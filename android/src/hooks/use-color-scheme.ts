import { useAppTheme } from '../context/ThemeContext';

export function useColorScheme() {
  try {
    const { theme } = useAppTheme();
    return theme;
  } catch {
    return 'light';
  }
}
