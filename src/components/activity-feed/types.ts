import type { FilterTabOption } from "@/components/ui-atoms/filter-tabs";
import type { FormattedActivity } from "@/lib/activity-format";

import type { ActivityTypeFilter } from "./use-activity-page";

export interface ActivityFeedViewProps {
  type: ActivityTypeFilter;
  typeOptions: FilterTabOption<ActivityTypeFilter>[];
  onTypeChange: (type: ActivityTypeFilter) => void;
  entries: FormattedActivity[];
  /** 已加载的全部条数（筛选前）。 */
  total: number;
  now: number;
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}
