import type { InconsistencyTab } from "@/lib/inconsistency-labels";
import type {
  InconsistencyDetail,
  InconsistencyRead,
} from "@/services/inconsistency-service";

export interface InconsistencyDetailSheetViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 关闭后保留上一条（淡出期间内容不闪空）。 */
  detail: InconsistencyDetail | undefined;
  loading: boolean;
  /** 已格式化的错误文案；null 无。 */
  errorMessage: string | null;
  /** admin 才能标记；viewer 为 false。 */
  canResolve: boolean;
  resolving: boolean;
  onResolve: (id: string) => void;
}

export interface InconsistencyCenterViewProps {
  tab: InconsistencyTab;
  onTabChange: (tab: InconsistencyTab) => void;
  /** 未处理数（侧栏徽标同一份）；拿不到为 undefined。 */
  unresolvedCount: number | undefined;
  items: InconsistencyRead[];
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (id: string) => void;
  canResolve: boolean;
  onResolve: (id: string) => void;
  resolvingId: string | null;
  sheet: InconsistencyDetailSheetViewProps;
}
