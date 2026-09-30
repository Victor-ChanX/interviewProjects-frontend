import type { GroupRead } from "@/services/group-service";

export interface GroupListViewProps {
  groups: GroupRead[];
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  onOpen: (id: string) => void;
}
