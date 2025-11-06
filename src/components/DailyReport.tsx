import { useState, useEffect } from "react";
import { Calendar, TrendingUp, IndianRupee, ShoppingBag, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Backend API
const API = (import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:4001";

const fetchDailyReport = async (date: string) => {
  try {
    const res = await fetch(`${API}/reports/daily?date=${encodeURIComponent(date)}`);
    if (!res.ok) throw new Error("Failed to fetch report");
    return await res.json();
  } catch (e) {
    console.warn("Failed to load report from backend, falling back to placeholder", e);
    return {
      date,
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      totalCustomers: 0,
      topItems: [],
      hourlyBreakdown: [],
    };
  }
};

type DailyReportData = {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalCustomers: number;
  topItems: Array<{ name: string; quantity: number; revenue: number }>;
  hourlyBreakdown: Array<{ hour: string; orders: number; revenue: number }>;
};

export const DailyReport = ({ refreshKey }: { refreshKey?: number }) => {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState<DailyReportData | null>(null);

  useEffect(() => {
    loadReport();
  }, [reportDate]);

  // Listen for cross-tab report updates (e.g., when kitchen generates a bill)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "reports-updated") {
        loadReport();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reportDate]);

  // When parent signals a refresh in the same tab (reportTick), reload
  useEffect(() => {
    if (typeof refreshKey === "number") {
      loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const loadReport = async () => {
    const data = await fetchDailyReport(reportDate);
    setReport(data);
  };

  if (!report)
    return (
      <Card className="p-6 text-center">
        <h3 className="text-lg font-medium">Loading report…</h3>
        <p className="text-sm text-muted-foreground mt-2">Fetching data from the backend</p>
      </Card>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Daily Report</h2>
          <p className="text-muted-foreground">View sales and performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="px-4 py-2 rounded-md border bg-background"
              max={new Date().toISOString().split("T")[0]}
            />
            <Button onClick={() => {
              // set to today's date and reload explicitly
              const today = new Date().toISOString().split("T")[0];
              setReportDate(today);
              // ensure immediate reload (loadReport reads reportDate state)
              setTimeout(() => loadReport(), 0);
            }} size="sm">Today</Button>
            <Button onClick={() => loadReport()} size="sm" className="ml-2">Refresh</Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-3xl font-bold mt-2">{report.totalOrders}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-3xl font-bold mt-2">₹{report.totalRevenue}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <IndianRupee className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg. Order Value</p>
              <p className="text-3xl font-bold mt-2">₹{report.averageOrderValue.toFixed(0)}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-3xl font-bold mt-2">{report.totalCustomers}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>
      </div>

      {/* Top Items */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Top Selling Items
        </h3>
        <div className="space-y-3">
          {report.topItems.length === 0 && (
            <div className="text-muted-foreground">No sales for the selected date.</div>
          )}
          {report.topItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-4">
                <Badge className="text-lg px-3 py-1">#{idx + 1}</Badge>
                <div>
                  <p className="font-medium text-lg">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.quantity} orders</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-xl">₹{item.revenue}</p>
                <p className="text-sm text-muted-foreground">
                  ₹{item.quantity ? (item.revenue / item.quantity).toFixed(0) : "-"} per item
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Hourly Breakdown */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Hourly Breakdown
        </h3>
        <div className="space-y-2">
          {report.hourlyBreakdown.map((hour, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <span className="font-medium w-20">{hour.hour}</span>
              <div className="flex-1 bg-muted rounded-full h-8 relative overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all flex items-center justify-end pr-3"
                  style={{
                    // avoid divide-by-zero when all revenues are zero
                    width: `${(hour.revenue / Math.max(1, ...report.hourlyBreakdown.map((h) => h.revenue))) * 100}%`,
                  }}
                >
                  <span className="text-xs font-medium text-primary-foreground">
                    {hour.orders} orders
                  </span>
                </div>
              </div>
              <span className="font-bold w-24 text-right">₹{hour.revenue}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
