import { useQuery } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export type ReportStats = {
  total_reports: number;
  synced_reports: number;
  unsynced_reports: number;
  total_categories: number;
  total_officers: number;
  reports_by_category: { category: string; count: number }[];
  reports_by_polda: { polda: string; count: number }[];
  recent_reports: {
    id: number;
    code: string;
    description: string;
    report_category_name: string;
    officer_name: string;
    created_at: string;
  }[];
};

/**
 * Custom hook to fetch and manage report statistics
 * Aggregates data from reports and report_embeddings tables
 */
export function useReportStats() {
  const supabase = createClientComponentClient();

  return useQuery({
    queryKey: ['report-stats'],
    queryFn: async (): Promise<ReportStats> => {
      // Parallel queries for better performance
      const [
        { count: totalReports },
        { count: syncedReports },
        { data: categoryData },
        { data: poldaData },
        { data: recentReports },
      ] = await Promise.all([
        // Total reports count
        supabase
          .from('reports')
          .select('*', { count: 'exact', head: true }),

        // Synced reports count
        supabase
          .from('report_embeddings')
          .select('*', { count: 'exact', head: true }),

        // Category data
        supabase
          .from('reports')
          .select('report_category_name, officer_name')
          .not('report_category_name', 'is', null),

        // Polda data
        supabase
          .from('reports')
          .select('polda_name')
          .not('polda_name', 'is', null),

        // Recent reports
        supabase
          .from('reports')
          .select(
            'id, code, description, report_category_name, officer_name, created_at'
          )
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      // Aggregate category counts
      const categoryCounts = categoryData?.reduce(
        (acc: Record<string, number>, row) => {
          const cat = row.report_category_name || 'Unknown';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        },
        {}
      );

      const reportsByCategory = Object.entries(categoryCounts || {})
        .map(([category, count]) => ({ category, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Aggregate polda counts
      const poldaCounts = poldaData?.reduce(
        (acc: Record<string, number>, row) => {
          const polda = row.polda_name || 'Unknown';
          acc[polda] = (acc[polda] || 0) + 1;
          return acc;
        },
        {}
      );

      const reportsByPolda = Object.entries(poldaCounts || {})
        .map(([polda, count]) => ({ polda, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate unique metrics
      const totalCategories = Object.keys(categoryCounts || {}).length;
      const uniqueOfficers = new Set(
        categoryData?.map((r) => r.officer_name).filter(Boolean)
      ).size;

      return {
        total_reports: totalReports || 0,
        synced_reports: syncedReports || 0,
        unsynced_reports: (totalReports || 0) - (syncedReports || 0),
        total_categories: totalCategories,
        total_officers: uniqueOfficers,
        reports_by_category: reportsByCategory,
        reports_by_polda: reportsByPolda,
        recent_reports: recentReports || [],
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

/**
 * Helper hook to get sync percentage
 */
export function useSyncPercentage() {
  const { data: stats } = useReportStats();

  if (!stats || stats.total_reports === 0) return 0;

  return Math.round((stats.synced_reports / stats.total_reports) * 100);
}
