/**
 * The component kit's public surface. Screens import from `../ui`, never from a file inside it,
 * so the kit can be rearranged without touching six screens.
 */
export { AppShell, type AppShellProps } from './AppShell'
export { DESTINATIONS, titleFor, type Destination } from './destinations'
export { BottomSheet, type BottomSheetProps } from './BottomSheet'
export { DataTable, type Column, type DataTableProps } from './DataTable'
export { SignedDelta, type SignedDeltaProps } from './SignedDelta'
export { StatTile, type StatTileProps } from './StatTile'
export { ToastProvider } from './Toast'
export { useToast, type ToastApi, type ToastOptions, type ToastStatus } from './toastContext'
export {
  ChartSkeleton,
  EmptyState,
  PricesAsOfBadge,
  Skeleton,
  StatusBadge,
  type PricesAsOf,
} from './States'
export {
  Button,
  Card,
  Checkbox,
  Label,
  Legend,
  MiniButton,
  SectionHeading,
  Select,
  SeriesKey,
  TextField,
  type SelectOption,
} from './primitives'
export { useElementWidth } from './useElementWidth'
export { applyTheme, readStoredTheme, useTheme, THEME_STORAGE_KEY, type Theme } from './theme'
export { DEEP_DISCOUNT, WELL_ABOVE, zoneFor, type Zone, type ZoneId } from './zones'

export { ChartFrame, Readout, type ChartFrameProps } from './charts/ChartFrame'
export { DiscountMeter, type DiscountMeterProps } from './charts/DiscountMeter'
export { DivergingBars, type DivergingBarsProps } from './charts/DivergingBars'
export { HistoryChart, type HistoryChartProps } from './charts/HistoryChart'
export { Sparkline, type SparklineProps } from './charts/Sparkline'
export { StepLineChart, type EstimateChange, type StepLineChartProps } from './charts/StepLineChart'

export * from './format'
