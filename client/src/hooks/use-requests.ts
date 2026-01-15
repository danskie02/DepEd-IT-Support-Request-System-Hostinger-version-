import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateRequestPayload, type UpdateRequestStatusPayload } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useRequests(autoRefresh = false) {
  return useQuery({
    queryKey: [api.requests.list.path],
    queryFn: async () => {
      const res = await fetch(api.requests.list.path, {
        credentials: "include", // Include cookies for session
      });
      if (!res.ok) throw new Error("Failed to fetch requests");
      return api.requests.list.responses[200].parse(await res.json());
    },
    refetchInterval: autoRefresh ? 60000 : false, // Auto-refresh every 60 seconds if enabled
    refetchIntervalInBackground: autoRefresh, // Continue refreshing even when tab is in background
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRequestPayload) => {
      const res = await fetch(api.requests.create.path, {
        method: api.requests.create.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for session
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create request");
      return api.requests.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.requests.list.path] });
      toast({ title: "Success", description: "Request submitted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useRequest(id: number) {
  return useQuery({
    queryKey: [api.requests.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.requests.get.path, { id });
      const res = await fetch(url, {
        credentials: "include", // Include cookies for session
      });
      if (!res.ok) throw new Error("Failed to fetch request");
      return api.requests.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateRequestStatusPayload & { id: number }) => {
      const url = buildUrl(api.requests.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.requests.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for session
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return api.requests.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.requests.list.path] });
      toast({ title: "Status Updated", description: "Request status has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
