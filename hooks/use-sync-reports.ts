import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from '@/components/ui/use-toast';

type K3IReport = {
  id: number;
  code: string;
  description: string;
  report_category_id: number;
  report_category_name: string;
  report_category_icon: string;
  report_category_color: string;
  officer_name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  polda_id: number;
  polda_name: string;
  polda_logo: string;
  polres_id: number;
  polres_name: string;
  nrp: string;
  created_at: string;
  // ... other fields as needed
};

type K3IResponse = {
  statusCode: number;
  responseMessage: string;
  isSuccess: boolean;
  data: K3IReport[];
};

type SyncResult = {
  success: boolean;
  total_fetched: number;
  new_reports: number;
  existing_reports: number;
  synced_embeddings: number;
  message: string;
};

/**
 * Custom hook to sync reports from external K3I API
 *
 * Flow:
 * 1. Fetch reports from external API
 * 2. Check which reports already exist in Supabase
 * 3. Insert only new reports
 * 4. Generate embeddings for all new reports
 */
export function useSyncReports() {
  const supabase = createClientComponentClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Step 1: Fetch reports from external K3I API
      console.log('Fetching reports from K3I API...');
      const apiUrl = `${process.env.NEXT_PUBLIC_K3I_URL}/v3/report?order=created_at&orderDirection=desc`;
      const apiToken = process.env.NEXT_PUBLIC_K3I_TOKEN ||
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJWVEpHYzJSSFZtdFlNUzgzZDNkT1FVbEpXVVFyVkROTmRXRjNlblUyU1hCNk5rTkRhbU5pWnpkbk5EMCIsInBvbGRhX2lkIjoiVlRKR2MyUkhWbXRZTVRoWVIwTnBVbTB5U2sxdlNEQmpjV2gzVFM5NVR6WXJibGRhT1VWeE9VVnVPRDAiLCJ0eXBlX2JhY2tlbmQiOiJ3ZWIiLCJpYXQiOjE3NjY1MDcwNjEsImV4cCI6MTc2NjU5MzQ2MSwiYXVkIjoiRzIwIiwiaXNzIjoiS29ybGFudGFzUG9scmkiLCJzdWIiOiJLM0lHMjAifQ.M5y5-9uHZdyRRGLpirxzCkN-TqkZqev4jyIT_oSqXOHEcZgd6v8NJunmpr-mfJiGWWZk7QTsaB8L7Kh5FsGCKoH7YP2N20c3C6n-MIexHq0KC5d5WSoocmZ0LpXaQUGtmrVta3EUgyKOGxCuLmB-6Hh-2CHb7uUyo-mpw9AI1_-LKtXFJ_ViH0YbV0e9on1rRtRU0etXOqv7e3sJViIASjTo0WGqXR2NImtGDR-JXXF5qikUWZv77pDhobUunOtoITl4nrbGtSv-aIuqTQOin9BKFqXOXPjF8VobJ_5yf5j_fMXpYoXizyZCTzSiB_hLaEntlAXzlZrG6rSGCibtYkoThUOZMXqb4WUFebJhbalLOlEPbEg3zTV1usFssG_WA567F7veqMccntlfMppuWSS7_2vOOMdF8Za_lmlk0dkByrAsEdOoMuRkn4yCgZYDX0kucbh6JlrEZZEFNPDynK3Th2PKjS9lC9Ow0OEdw-5QipH5SE5W7iQUlvdAFFSGULm9CeCp3gAbh6rJ2QB0CZ9nSCue4B7Gu_c02OBULwy4BoSHT0D1eCqDItPQZDQf7aP6J6vWE8XlMe4LOKhloiEBgLaiFX6Vz4mv8bmIgL86H83CUWeOwmrtG_nHA4i5m7wU8I2a7dmnI--x0D8WrlmCtxMYJ6v9xB4R-VNRwBA';

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiToken,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch from K3I API: ${response.statusText}`);
      }

      const k3iData: K3IResponse = await response.json();

      if (!k3iData.isSuccess || !k3iData.data) {
        throw new Error(k3iData.responseMessage || 'Failed to fetch reports');
      }

      const totalFetched = k3iData.data.length;
      console.log(`Fetched ${totalFetched} reports from K3I API`);

      // Step 2: Check which reports already exist in Supabase
      const reportIds = k3iData.data.map((r) => r.id);
      const { data: existingReports } = await supabase
        .from('reports')
        .select('id')
        .in('id', reportIds);

      const existingIds = new Set(existingReports?.map((r) => r.id) || []);
      console.log(`Found ${existingIds.size} existing reports`);

      // Step 3: Filter new reports
      const newReports = k3iData.data.filter((r) => !existingIds.has(r.id));

      if (newReports.length === 0) {
        return {
          success: true,
          total_fetched: totalFetched,
          new_reports: 0,
          existing_reports: existingIds.size,
          synced_embeddings: 0,
          message: 'No new reports to sync',
        };
      }

      console.log(`Inserting ${newReports.length} new reports...`);

      // Step 4: Transform and insert new reports
      const transformedReports = newReports.map((report) => ({
        id: report.id,
        code: report.code,
        description: report.description,
        report_category_id: report.report_category_id,
        report_category_name: report.report_category_name,
        report_category_icon: report.report_category_icon,
        report_category_color: report.report_category_color,
        officer_name: report.officer_name,
        address: report.address,
        latitude: report.latitude,
        longitude: report.longitude,
        polda_id: report.polda_id,
        polda_name: report.polda_name,
        polda_logo: report.polda_logo,
        polres_id: report.polres_id,
        polres_name: report.polres_name,
        nrp: report.nrp,
        created_at: report.created_at,
      }));

      // Insert to the reports table
      const { error: insertError } = await supabase
        .from('reports')
        .insert(transformedReports);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(`Failed to insert reports: ${insertError.message}`);
      }

      console.log(`Successfully inserted ${newReports.length} reports`);

      // Step 5: Generate embeddings for new reports
      console.log('Generating embeddings...');
      const embeddingServiceUrl = process.env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL ||
        'http://localhost:8001';

      // Generate searchable content for each report
      const searchableContents = newReports.map((report) => {
        const parts = [
          `Kategori: ${report.report_category_name || ''}`,
          `Petugas: ${report.officer_name || ''}`,
          `Lokasi: ${report.address || ''}`,
          `Polda: ${report.polda_name || ''}`,
          `Polres: ${report.polres_name || ''}`,
          `Deskripsi: ${report.description || ''}`,
        ];
        return parts.filter((p) => p.split(': ')[1]).join(' | ');
      });

      // Call embedding service
      const embeddingResponse = await fetch(`${embeddingServiceUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts: searchableContents }),
      });

      if (!embeddingResponse.ok) {
        console.error('Embedding service failed, but reports were inserted');
        return {
          success: true,
          total_fetched: totalFetched,
          new_reports: newReports.length,
          existing_reports: existingIds.size,
          synced_embeddings: 0,
          message: `Inserted ${newReports.length} reports, but embedding failed`,
        };
      }

      const { embeddings } = await embeddingResponse.json();

      // Step 6: Insert embeddings to report_embeddings table
      const embeddingData = newReports.map((report, i) => ({
        report_id: report.id,
        searchable_content: searchableContents[i],
        embedding: embeddings[i],
      }));

      const { error: embeddingError } = await supabase
        .from('report_embeddings')
        .upsert(embeddingData, { onConflict: 'report_id' });

      if (embeddingError) {
        console.error('Embedding insert error:', embeddingError);
        return {
          success: true,
          total_fetched: totalFetched,
          new_reports: newReports.length,
          existing_reports: existingIds.size,
          synced_embeddings: 0,
          message: `Inserted ${newReports.length} reports, but embedding storage failed`,
        };
      }

      console.log(`Successfully synced ${newReports.length} embeddings`);

      return {
        success: true,
        total_fetched: totalFetched,
        new_reports: newReports.length,
        existing_reports: existingIds.size,
        synced_embeddings: newReports.length,
        message: `Successfully synced ${newReports.length} new reports with embeddings`,
      };
    },
    onSuccess: (data) => {
      toast({
        title: 'Sync Complete',
        description: data.message,
      });

      // Invalidate and refetch report stats
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error.message,
      });
    },
  });
}

/**
 * Hook to sync specific reports by IDs
 */
export function useSyncSpecificReports() {
  const supabase = createClientComponentClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportIds: number[]) => {
      // Similar logic but only sync specific IDs
      // Implementation would filter K3I data by specific IDs
      throw new Error('Not yet implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
    },
  });
}
