// Icon names an admin may pick, resolved to components.
//
// A closed map rather than a lookup into lucide's whole export surface: the
// value comes from the DB, and `(lucide as any)[name]` on unvalidated data would
// render `undefined` as a component and crash the page. Keep in sync with
// FEATURE_ICON_NAMES in lib/landing/blocks.ts — the zod enum guards the write
// side, this map the read side.

import {
  Award,
  Clock,
  Eye,
  Leaf,
  MessageCircle,
  Package,
  Printer,
  Shield,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { FeatureIconName } from "@/lib/landing/blocks";

export const BLOCK_ICONS: Record<FeatureIconName, React.ElementType> = {
  Zap,
  Shield,
  Eye,
  MessageCircle,
  Printer,
  Clock,
  Package,
  Sparkles,
  Users,
  Wrench,
  Leaf,
  Award,
};
