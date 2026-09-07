import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/lib/theme';

const heroColors: [string, string, ...string[]] = ['#1E3A8A', '#2563EB', '#3B82F6'];
const defaultColors: [string, string, ...string[]] = ['#F0F4FF', '#EFF6FF', '#F9FAFB'];

export function GradientBackground({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'hero' }) {
  const colors = variant === 'hero' ? heroColors : defaultColors;

  return (
    <LinearGradient
      colors={colors}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {children}
    </LinearGradient>
  );
}

export { Colors };
