import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, User, LayoutDashboard, PlusCircle, ShieldCheck } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img
              src="/DepEdMdq_logo.png"
              alt="DepEd Logo"
              className="h-16 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="font-display font-bold text-xl md:text-2xl tracking-tight">
              DepEd <span className="text-secondary font-black">Marinduque IT Services</span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm font-medium opacity-90">
              <User className="w-4 h-4" />
              <span>{user.name}</span>
              <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full text-xs font-bold uppercase">
                {user.role}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logout()}
              className="font-bold shadow-sm hover:shadow-md transition-all"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="flex-1 container mx-auto px-4 py-8">
        {user.role === 'admin' ? (
          /* Admin: Full width, no sidebar */
          <main className="w-full">
            {/* show button when not already on dashboard */}
            {location.startsWith("/admin") && location !== "/admin/dashboard" && (
              <div className="mb-4">
                <Link href="/admin/dashboard">
                  <Button variant="secondary" size="sm">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
              </div>
            )}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[500px] p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {children}
            </div>
          </main>
        ) : (
          /* User: With sidebar */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <aside className="md:col-span-3 lg:col-span-2">
              <nav className="flex flex-col gap-2 sticky top-24">
                <NavLink href="/dashboard" active={location === "/dashboard"}>
                  <LayoutDashboard className="w-5 h-5" />
                  My Requests
                </NavLink>
                <NavLink href="/new-request" active={location === "/new-request"}>
                  <PlusCircle className="w-5 h-5" />
                  New Request
                </NavLink>
              </nav>
            </aside>
            <main className="md:col-span-9 lg:col-span-10">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[500px] p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {children}
              </div>
            </main>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Department of Education - IT Service Request System
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`
      flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200
      ${active
        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 translate-x-1"
        : "text-gray-600 hover:bg-gray-100 hover:text-primary"}
    `}>
      {children}
    </Link>
  );
}
