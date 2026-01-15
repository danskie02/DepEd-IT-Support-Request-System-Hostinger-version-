import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type LoginRequest, type VerifyOtpRequest } from "@shared/routes";
import { type InsertUser } from "@shared/schema";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, {
        credentials: "include", // Include cookies for session
      });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return api.auth.me.responses[200].parse(await res.json());
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for session
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid credentials");
        throw new Error("Login failed");
      }
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      toast({ title: "Verification code sent", description: "Please check your email/phone." });
      setLocation(`/verify-otp?userId=${data.userId}`);
    },
    onError: (error) => {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for session
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 400) {
          const err = await res.json();
          throw new Error(err.message || "Registration failed");
        }
        throw new Error("Registration failed");
      }
      return api.auth.register.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      toast({ title: "Account created", description: "Please verify your account." });
      setLocation(`/verify-otp?userId=${data.userId}`);
    },
    onError: (error) => {
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: VerifyOtpRequest) => {
      const res = await fetch(api.auth.verify.path, {
        method: api.auth.verify.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Important: include cookies for session
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Invalid or expired OTP code");
      }
      const userData = await res.json();
      return api.auth.verify.responses[200].parse(userData);
    },
    onSuccess: (user) => {
      // Update user data in cache
      queryClient.setQueryData([api.auth.me.path], user);
      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      
      toast({ title: "Verification Successful!", description: `Welcome, ${user.name}!` });
      
      // Redirect after a brief delay to ensure state is updated
      setTimeout(() => {
        if (user.role === 'admin') {
          window.location.href = "/admin/dashboard";
        } else {
          window.location.href = "/dashboard";
        }
      }, 300);
    },
    onError: (error) => {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch(api.auth.logout.path, { method: api.auth.logout.method });
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      setLocation("/login");
      toast({ title: "Logged out" });
    },
  });

  return {
    user,
    isLoadingUser,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    verifyOtp: verifyOtpMutation.mutate,
    isVerifying: verifyOtpMutation.isPending,
    logout: logoutMutation.mutate,
  };
}
