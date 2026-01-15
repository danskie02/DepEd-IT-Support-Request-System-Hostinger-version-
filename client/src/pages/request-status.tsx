import { useRoute, useLocation, Link } from "wouter";
import { useRequest } from "@/hooks/use-requests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { ArrowLeft, Calendar, AlertCircle, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { formatLocalDate } from "@/lib/date-utils";

export default function RequestStatusPage() {
    const [, params] = useRoute("/request/:id");
    const [, setLocation] = useLocation();

    // Extract request ID from URL params
    const requestId = parseInt(params?.id || "0");

    const { data: request, isLoading, error } = useRequest(requestId);

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-muted-foreground animate-pulse">Loading request details...</p>
                </div>
            </div>
        );
    }

    if (error || !request) {
        return (
            <div className="max-w-2xl mx-auto">
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-4 w-fit">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6 text-center">
                        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-red-900 mb-2">Request Not Found</h3>
                        <p className="text-red-700 mb-4">The request you're looking for doesn't exist or you don't have permission to view it.</p>
                        <Button onClick={() => setLocation("/dashboard")}>Go to Dashboard</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const getStatusIcon = () => {
        switch (request.status) {
            case "approved":
                return <CheckCircle2 className="w-6 h-6 text-green-600" />;
            case "denied":
                return <XCircle className="w-6 h-6 text-red-600" />;
            default:
                return <AlertCircle className="w-6 h-6 text-yellow-600" />;
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-4 w-fit">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-mono text-muted-foreground bg-gray-100 px-3 py-1 rounded-full font-medium">
                                Request #{request.id.toString().padStart(4, '0')}
                            </span>
                            <StatusBadge status={request.status as any} />
                        </div>
                        <h1 className="text-3xl font-display font-bold text-gray-900 mt-2">{request.title}</h1>
                    </div>
                    {getStatusIcon()}
                </div>
            </div>

            {/* Main Content Card */}
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Request Details
                    </CardTitle>
                    <CardDescription>Complete information about your service request</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Information Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Submitted On
                            </span>
                            <p className="text-base font-medium">
                                {formatLocalDate(request.createdAt, "PPP 'at' h:mm a")}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Category
                            </span>
                            <p className="text-base font-medium">{request.category}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Priority Level</span>
                            <div className="mt-1">
                                <PriorityBadge priority={request.priority} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Status</span>
                            <div className="mt-1">
                                <StatusBadge status={request.status as any} />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-900">Description</h3>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{request.description}</p>
                        </div>
                    </div>

                    {/* Admin Response */}
                    {request.adminResponse && (
                        <div className="space-y-2 pt-4 border-t">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                {request.status === "approved" ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-600" />
                                )}
                                Administrative Response
                            </h3>
                            <div className={`p-4 rounded-lg border-2 ${request.status === "approved"
                                    ? "bg-green-50 border-green-200"
                                    : "bg-red-50 border-red-200"
                                }`}>
                                <p className={`leading-relaxed whitespace-pre-wrap ${request.status === "approved" ? "text-green-900" : "text-red-900"
                                    }`}>
                                    {request.adminResponse}
                                </p>
                            </div>
                            {request.updatedAt && (
                                <p className="text-xs text-muted-foreground">
                                    Updated on {formatLocalDate(request.updatedAt, "PPP 'at' h:mm a")}
                                </p>
                            )}
                        </div>
                    )}

                    {request.status === "pending" && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-yellow-900 mb-1">Under Review</p>
                                <p className="text-sm text-yellow-700">
                                    Your request is currently being reviewed by an administrator. You will be notified once a decision has been made.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
                <Button onClick={() => setLocation("/dashboard")} variant="outline" className="flex-1">
                    Back to My Requests
                </Button>
                <Button onClick={() => setLocation("/new-request")} className="flex-1">
                    Submit New Request
                </Button>
            </div>
        </div>
    );
}
