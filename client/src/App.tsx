import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";

// Pages
import LoginPage from "@/pages/login";
import UserLoginPage from "@/pages/user-login";
import VerifyOtpPage from "@/pages/verify-otp";
import Dashboard from "@/pages/dashboard";
import NewRequestPage from "@/pages/new-request";
import RequestStatusPage from "@/pages/request-status";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminSettings from "@/pages/admin-settings";
import AdminUsers from "@/pages/admin-users";
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
      <Route path="/" component={() => <Redirect to="/new-request" />} />
      <Route path="/login" component={LoginPage} />
      <Route path="/user-login" component={UserLoginPage} />
      <Route path="/verify-otp" component={VerifyOtpPage} />
      
      {/* Public Routes - Accessible without authentication */}
      <Route path="/new-request" component={NewRequestPage} />
      
      {/* Protected User Routes */}
      <Route path="/dashboard">
        <PrivateRoute component={Dashboard} />
      </Route>
      <Route path="/request/:id">
        <PrivateRoute component={RequestStatusPage} />
      </Route>

      {/* Protected Admin Routes */}
      <Route path="/admin/dashboard">
        <PrivateRoute component={AdminDashboard} adminOnly />
      </Route>
      <Route path="/admin/settings">
        <PrivateRoute component={AdminSettings} adminOnly />
      </Route>
      <Route path="/admin/users">
        <PrivateRoute component={AdminUsers} adminOnly />
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
