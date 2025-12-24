"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useReportStats, useSyncReports, useSyncPercentage } from "@/hooks";
import {
  Loader2,
  RefreshCw,
  Database,
  FileText,
  Calendar,
  User,
  Shield,
} from "lucide-react";

export default function SyncReportPage() {
  // Custom hooks for data and mutations
  const { data: stats, isLoading: statsLoading } = useReportStats();
  const syncMutation = useSyncReports();
  const syncPercentage = useSyncPercentage();

  // Handler functions
  const handleSyncAll = () => {
    syncMutation.mutate();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Report Sync Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage and sync report embeddings for AI-powered search
          </p>
        </div>
        <Button
          onClick={handleSyncAll}
          disabled={syncMutation.isPending}
          size="lg"
        >
          {syncMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync All Reports
            </>
          )}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Reports"
          value={stats?.total_reports}
          description="In database"
          icon={Database}
          loading={statsLoading}
        />
        <StatCard
          title="Synced Reports"
          value={stats?.synced_reports}
          description={`${syncPercentage}% synced with embeddings`}
          icon={FileText}
          loading={statsLoading}
          valueClassName="text-green-600"
        />
        <StatCard
          title="Categories"
          value={stats?.total_categories}
          description="Report categories"
          icon={Shield}
          loading={statsLoading}
        />
        <StatCard
          title="Officers"
          value={stats?.total_officers}
          description="Unique officers"
          icon={User}
          loading={statsLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart
          data={stats?.reports_by_category}
          total={stats?.total_reports || 1}
          loading={statsLoading}
        />
        <PoldaChart
          data={stats?.reports_by_polda}
          total={stats?.total_reports || 1}
          loading={statsLoading}
        />
      </div>

      {/* Recent Reports */}
      <RecentReportsCard data={stats?.recent_reports} loading={statsLoading} />
    </div>
  );
}

// Extracted components for better code organization

type StatCardProps = {
  title: string;
  value?: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  valueClassName?: string;
};

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
  valueClassName = "",
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClassName}`}>
          {loading ? "-" : value?.toLocaleString()}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

type ChartData = { category?: string; polda?: string; count: number }[];

function CategoryChart({
  data,
  total,
  loading,
}: {
  data?: ChartData;
  total: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Categories</CardTitle>
        <CardDescription>Most reported categories</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading...
            </div>
          ) : (
            data?.map((item) => (
              <ProgressBar
                key={item.category}
                label={item.category || "Unknown"}
                value={item.count}
                total={total}
                color="bg-primary"
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PoldaChart({
  data,
  total,
  loading,
}: {
  data?: ChartData;
  total: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Polda</CardTitle>
        <CardDescription>Reports by regional police</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading...
            </div>
          ) : (
            data?.map((item) => (
              <ProgressBar
                key={item.polda}
                label={item.polda || "Unknown"}
                value={item.count}
                total={total}
                color="bg-blue-500"
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = (value / total) * 100;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium truncate max-w-[200px]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground min-w-[40px] text-right">
          {value}
        </span>
      </div>
    </div>
  );
}

type RecentReport = {
  id: number;
  code: string;
  description: string;
  report_category_name: string;
  officer_name: string;
  created_at: string;
};

function RecentReportsCard({
  data,
  loading,
}: {
  data?: RecentReport[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Reports</CardTitle>
        <CardDescription>Latest 5 reports in the system</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading...
            </div>
          ) : (
            data?.map((report) => (
              <ReportItem key={report.id} report={report} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReportItem({ report }: { report: RecentReport }) {
  return (
    <div className="border-l-4 border-primary pl-4 py-2 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">
              {report.code || `#${report.id}`}
            </span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              {report.report_category_name || "Uncategorized"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {report.description || "No description"}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {report.officer_name || "Unknown"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(report.created_at).toLocaleDateString("id-ID")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
