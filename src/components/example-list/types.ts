import type { ConnectionStatus } from "@/lib/ws";
import type { ExampleRead } from "@/services/example-service";

export interface ExampleListFilters {
  keyword: string;
}

export const EMPTY_EXAMPLE_LIST_FILTERS: ExampleListFilters = { keyword: "" };

export interface ExampleListViewProps {
  items: ExampleRead[];
  loading: boolean;
  error: unknown;
  retrying: boolean;
  filters: ExampleListFilters;
  connection: ConnectionStatus;
  onFiltersChange: (filters: ExampleListFilters) => void;
  onRetry: () => void;
  onOpen: (id: number) => void;
}
