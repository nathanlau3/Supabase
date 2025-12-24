# Custom React Query Hooks

This directory contains custom hooks following React Query best practices for the sync-report feature.

## Architecture

### Separation of Concerns

```
┌─────────────────┐
│   Page/UI       │  ← Uses hooks, handles rendering
└────────┬────────┘
         │
┌────────▼────────┐
│  Custom Hooks   │  ← Business logic, API calls
└────────┬────────┘
         │
┌────────▼────────┐
│  React Query    │  ← Caching, state management
└────────┬────────┘
         │
┌────────▼────────┐
│ Supabase/APIs   │  ← Data sources
└─────────────────┘
```

## Available Hooks

### 1. **`useReportStats()`**
Fetches and aggregates report statistics from the database.

**Returns:**
- `data`: ReportStats object with counts and aggregations
- `isLoading`: Loading state
- `error`: Error state
- `refetch`: Manual refetch function

**Features:**
- Parallel queries for performance
- 5-minute cache (staleTime)
- Auto-aggregation of categories and polda data

**Usage:**
```tsx
const { data: stats, isLoading } = useReportStats();

if (isLoading) return <Spinner />;
console.log(stats.total_reports);
```

### 2. **`useSyncPercentage()`**
Helper hook to calculate sync percentage.

**Returns:** Number (0-100)

**Usage:**
```tsx
const syncPercentage = useSyncPercentage();
// Returns: 75 (if 75% of reports are synced)
```

### 3. **`useSyncReports()`**
Mutation hook to sync reports with vector embeddings.

**Returns:**
- `mutate`: Function to trigger sync
- `isPending`: Loading state
- `error`: Error state

**Features:**
- Calls `/functions/v1/sync-reports` edge function
- Auto-invalidates `report-stats` cache on success
- Toast notifications for success/error

**Usage:**
```tsx
const syncMutation = useSyncReports();

// Sync all reports
syncMutation.mutate({ sync_all: true });

// Sync specific reports
syncMutation.mutate({ report_ids: [1, 2, 3] });
```

### 4. **`useSyncSpecificReports()`**
Convenience wrapper for syncing specific reports.

**Usage:**
```tsx
const { syncByIds } = useSyncSpecificReports();

syncByIds([1, 2, 3, 4, 5]);
```

### 5. **`useFetchExternalApi()`**
Mutation hook to fetch and import data from external REST APIs.

**Returns:**
- `mutate`: Function to trigger fetch
- `isPending`: Loading state
- `data`: Fetched data (raw + transformed)

**Features:**
- Custom transformation functions
- Auto-insert to database (optional)
- Built-in error handling

**Usage:**
```tsx
const fetchMutation = useFetchExternalApi();

// Simple fetch
fetchMutation.mutate({
  url: 'https://api.example.com/reports'
});

// With transformation
fetchMutation.mutate({
  url: 'https://api.example.com/reports',
  transformFn: apiTransformers.toReportFormat,
  autoSync: true  // Auto-insert to database
});
```

## Benefits of This Architecture

### ✅ **Separation of Concerns**
- UI components focus on rendering
- Hooks handle data fetching and state
- Easy to test each layer independently

### ✅ **Reusability**
```tsx
// Use the same hook in multiple components
function Dashboard() {
  const { data } = useReportStats();
  return <StatCards stats={data} />;
}

function SidebarStats() {
  const { data } = useReportStats();  // Same data, cached!
  return <MiniStats stats={data} />;
}
```

### ✅ **Type Safety**
All hooks are fully typed with TypeScript:
```tsx
type ReportStats = {
  total_reports: number;
  synced_reports: number;
  // ... etc
}
```

### ✅ **Performance**
- Automatic caching (5-minute staleTime)
- Parallel queries
- Smart cache invalidation

### ✅ **Developer Experience**
- Clear, descriptive hook names
- Consistent API across all hooks
- Built-in loading and error states

## Adding New Hooks

### Template:

```tsx
// hooks/use-your-feature.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function useYourFeature() {
  const supabase = createClientComponentClient();

  return useQuery({
    queryKey: ['your-feature'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('your_table')
        .select('*');

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useYourMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: YourInput) => {
      // Your mutation logic
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['your-feature'] });
    },
  });
}
```

### Export in index.ts:
```tsx
export { useYourFeature, useYourMutation } from './use-your-feature';
```

## Testing Hooks

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReportStats } from './use-report-stats';

test('fetches report stats', async () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  const { result } = renderHook(() => useReportStats(), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data.total_reports).toBeGreaterThan(0);
});
```

## Best Practices

1. **Always use query keys**: Makes cache invalidation predictable
2. **Set appropriate staleTime**: Balance freshness vs performance
3. **Handle loading and error states**: Better UX
4. **Invalidate related queries**: Keep data fresh after mutations
5. **Use TypeScript**: Type safety prevents bugs
6. **Keep hooks focused**: One hook, one responsibility
7. **Document complex logic**: Future you will thank you

## Examples

See [app/sync-report/page.tsx](../app/sync-report/page.tsx) for complete implementation examples.
