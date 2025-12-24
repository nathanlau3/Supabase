import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type ExternalApiOptions = {
  url: string;
  transformFn?: (data: any) => any[];
  autoSync?: boolean;
};

/**
 * Custom hook to fetch and import data from external REST API
 * Supports custom transformation functions for different API formats
 */
export function useFetchExternalApi() {
  const supabase = createClientComponentClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ url, transformFn, autoSync = false }: ExternalApiOptions) => {
      if (!url) {
        throw new Error('Please enter an API URL');
      }

      // Fetch data from external API
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch from external API: ${response.statusText}`);
      }

      const externalData = await response.json();

      // Apply transformation if provided
      const transformedData = transformFn ? transformFn(externalData) : externalData;

      // Auto-insert to database if enabled
      if (autoSync && Array.isArray(transformedData)) {
        // Insert transformed data into reports table
        const { error: insertError } = await supabase
          .from('reports')
          .insert(transformedData);

        if (insertError) {
          throw new Error(`Failed to insert data: ${insertError.message}`);
        }

        toast({
          title: 'Data Imported',
          description: `${transformedData.length} records imported successfully`,
        });

        // Invalidate stats to refresh UI
        queryClient.invalidateQueries({ queryKey: ['report-stats'] });
      } else {
        toast({
          title: 'External Data Fetched',
          description: 'Data retrieved. Ready for manual processing.',
        });
      }

      return {
        raw: externalData,
        transformed: transformedData,
        count: Array.isArray(transformedData) ? transformedData.length : 0,
      };
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Fetch Failed',
        description: error.message,
      });
    },
  });
}

/**
 * Example transformation functions for common API formats
 */
export const apiTransformers = {
  // Standard JSON array
  jsonArray: (data: any[]) => data,

  // Nested data under 'results' key
  nestedResults: (data: { results: any[] }) => data.results || [],

  // Transform to match reports table schema
  toReportFormat: (data: any[]) =>
    data.map((item) => ({
      code: item.code || item.id,
      description: item.description || item.message,
      report_category_name: item.category || 'Imported',
      officer_name: item.officer || item.reporter,
      address: item.location || item.address,
      // Add more field mappings as needed
    })),
};
