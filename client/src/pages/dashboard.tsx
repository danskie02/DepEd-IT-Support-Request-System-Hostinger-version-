import { useRequests } from "@/hooks/use-requests";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Plus, FileText, Calendar, AlertCircle, Eye } from "lucide-react";
import { formatLocalDate } from "@/lib/date-utils";

export default function Dashboard() {
  const { data: requests, isLoading } = useRequests();

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading your requests...</p>
        </div>
      </div>
    );
  }

  const myRequests = requests || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">DepEd Marinduque IT Services - My Requests</h1>
          <p className="text-muted-foreground mt-1">Track the status of your IT service tickets</p>
        </div>
        <Link href="/new-request">
          <Button size="lg" className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
            <Plus className="w-5 h-5 mr-2" />
            New Service Request
          </Button>
        </Link>
      </div>

      {myRequests.length === 0 ? (
        <div className="text-center py-20 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
          <div className="bg-white p-4 rounded-full w-fit mx-auto shadow-sm mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No requests yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2 mb-6">
            You haven't submitted any service requests. Create one to get help from the IT team.
          </p>
          <Link href="/new-request">
            <Button variant="outline">Create First Request</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {myRequests.map((req) => (
            <Card key={req.id} className="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/10 hover:border-l-primary cursor-pointer group" onClick={() => window.location.href = `/request/${req.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4 justify-between md:items-start">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground bg-gray-100 px-2 py-0.5 rounded">
                        #{req.id.toString().padStart(4, '0')}
                      </span>
                      <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors">{req.title}</h3>
                    </div>
                    <p className="text-gray-600 line-clamp-2 text-sm">{req.description}</p>
                    <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatLocalDate(req.createdAt, "PPP")}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        Category: <span className="font-medium text-foreground">{req.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end gap-3 min-w-[140px]">
                    <StatusBadge status={req.status as any} />
                    <PriorityBadge priority={req.priority} />
                  </div>
                </div>

                {req.adminResponse && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm border">
                    <span className="font-bold block text-gray-700 mb-1">Admin Response:</span>
                    <p className="text-gray-600 line-clamp-2">{req.adminResponse}</p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t flex justify-end">
                  <Link href={`/request/${req.id}`}>
                    <Button variant="outline" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
