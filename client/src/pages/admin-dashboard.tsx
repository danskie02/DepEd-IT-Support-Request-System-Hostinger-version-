import { useState } from "react";
import { useLocation } from "wouter";
import { useRequests, useUpdateRequestStatus } from "@/hooks/use-requests";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { formatLocalDate } from "@/lib/date-utils";
import { Search, Filter, Eye, CheckCircle, XCircle, Loader2, Settings, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { data: requests, isLoading } = useRequests(true); // Enable auto-refresh for admin
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateRequestStatus();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "denied" | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  const filteredRequests = (requests || []).filter(req => {
    const matchesSearch =
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.id.toString().includes(searchTerm);

    const matchesStatus = statusFilter === "all" || req.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleUpdate = () => {
    if (!selectedRequest || !reviewAction) return;

    updateStatus(
      {
        id: selectedRequest.id,
        status: reviewAction,
        adminResponse
      },
      {
        onSuccess: () => {
          setSelectedRequest(null);
          setAdminResponse("");
          setReviewAction(null);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-gray-900">DepEd Marinduque IT Services - Admin Dashboard</h1>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Auto-refresh enabled
            </span>
          </div>
          <p className="text-muted-foreground mt-1">Manage and review all incoming service requests</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/users")}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            Users
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/settings")}
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-gray-50/50 border-none shadow-inner">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, Title, or User..."
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[80px] px-6 py-4">ID</TableHead>
              <TableHead className="px-6 py-4">User</TableHead>
              <TableHead className="px-6 py-4">Title</TableHead>
              <TableHead className="px-6 py-4">Category</TableHead>
              <TableHead className="px-6 py-4">Priority</TableHead>
              <TableHead className="w-[180px] px-6 py-4">Date & Time</TableHead>
              <TableHead className="px-6 py-4">Status</TableHead>
              <TableHead className="text-right px-6 py-4">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  No requests found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((req) => (
                <TableRow key={req.id} className="hover:bg-gray-50/50">
                  <TableCell className="font-mono text-xs font-medium px-6 py-4">#{req.id}</TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-sm">{req.user.name}</span>
                      <span className="text-xs text-muted-foreground">{req.user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium px-6 py-4">{req.title}</TableCell>
                  <TableCell className="px-6 py-4">{req.category}</TableCell>
                  <TableCell className="px-6 py-4">
                    <PriorityBadge priority={req.priority} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap px-6 py-4">
                    {formatLocalDate(req.createdAt, "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <StatusBadge status={req.status as any} />
                  </TableCell>
                  <TableCell className="text-right px-6 py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRequest(req)}
                    >
                      <Eye className="w-4 h-4 mr-1" /> Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              Request Review
              {selectedRequest && <span className="text-sm font-normal text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-md">#{selectedRequest.id}</span>}
            </DialogTitle>
            <DialogDescription>
              Review the details and provide an administrative response.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6 my-4">
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground">Submitted By</span>
                  <p className="font-medium text-base">{selectedRequest.user.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedRequest.user.email}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Date & Time</span>
                  <p className="font-medium">{formatLocalDate(selectedRequest.createdAt, "PPP 'at' h:mm a")}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Category</span>
                  <p className="font-medium">{selectedRequest.category}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Priority</span>
                  <p className="mt-1"><PriorityBadge priority={selectedRequest.priority} /></p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="font-semibold mb-2 text-sm text-gray-900">Description</h4>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedRequest.description}</p>
              </div>

              {/* Action Area */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-semibold text-sm">Admin Action</h4>

                {selectedRequest.status === "pending" ? (
                  <>
                    <Textarea
                      placeholder="Add a note or reason for your decision..."
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => { setReviewAction("approved"); }}
                        disabled={reviewAction === "approved"}
                        variant={reviewAction === "approved" ? "secondary" : "default"}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve Request
                      </Button>
                      <Button
                        className="flex-1"
                        variant={reviewAction === "denied" ? "secondary" : "destructive"}
                        onClick={() => { setReviewAction("denied"); }}
                        disabled={reviewAction === "denied"}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Deny Request
                      </Button>
                    </div>

                    {reviewAction && (
                      <div className="bg-blue-50 p-3 rounded text-sm text-blue-700 flex justify-between items-center animate-in fade-in">
                        <span>Ready to <strong>{reviewAction}</strong> this request?</span>
                        <Button size="sm" onClick={handleUpdate} disabled={isUpdating}>
                          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-gray-100 p-4 rounded text-center">
                    <p className="text-muted-foreground">This request has already been processed.</p>
                    <div className="mt-2 flex justify-center">
                      <StatusBadge status={selectedRequest.status} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
