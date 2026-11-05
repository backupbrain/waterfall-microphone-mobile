import Animated from 'react-native-reanimated';
import { withUniwind } from 'uniwind';

/** Reanimated view that also accepts Tailwind `className`. */
export const AnimatedView = withUniwind(Animated.View);
