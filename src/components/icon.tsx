import Feather from '@expo/vector-icons/Feather';
import { withUniwind } from 'uniwind';

/** Feather icon set that accepts Tailwind `className` (e.g. `text-foreground`). */
export const Icon = withUniwind(Feather);

export type IconName = React.ComponentProps<typeof Feather>['name'];
