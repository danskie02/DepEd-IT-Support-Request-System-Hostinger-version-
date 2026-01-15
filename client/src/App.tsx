import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";

// Pages
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import VerifyOtpPage from "@/pages/verify-otp";
import Dashboard from "@/pages/dashboard";
import NewRequestPage from "@/pages/new-request";
import RequestStatusPage from "@/pages/request-status";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function PrivateRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user, isLoadingUser } = useAuth();

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  if (adminOnly && user.role !== 'admin') {
    return <Redirect to="/dashboard" />;
  }
  
  // If verified user tries to access normal pages
  if (user && !user.isVerified) {
      return <Redirect to={`/verify-otp?userId=${user.id}`} />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/login" />} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/verify-otp" component={VerifyOtpPage} />
      
      {/* Protected User Routes */}
      <Route path="/dashboard">
        <PrivateRoute component={Dashboard} />
      </Route>
      <Route path="/new-request">
        <PrivateRoute component={NewRequestPage} />
      </Route>
      <Route path="/request/:id">
        <PrivateRoute component={RequestStatusPage} />
      </Route>

      {/* Protected Admin Routes */}
      <Route path="/admin/dashboard">
        <PrivateRoute component={AdminDashboard} adminOnly />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
