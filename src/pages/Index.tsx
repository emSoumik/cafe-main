import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CustomerApp } from "@/components/CustomerApp";
import { KitchenDashboard } from "@/components/KitchenDashboard";
import { Button } from "@/components/ui/button";
import { ChefHat, ShoppingBag } from "lucide-react";
import AuthModal from "@/components/AuthModal";

const Index = () => {
  const [activeView, setActiveView] = useState<"select" | "customer" | "kitchen">("select");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingView, setPendingView] = useState<"customer" | "kitchen" | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Check for existing auth on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    if (token && userData) {
      setAuthToken(token);
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleAuthSuccess = (token: string, userData: any) => {
    setAuthToken(token);
    setUser(userData);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(userData));
    setShowAuthModal(false);

    if (pendingView) {
      setActiveView(pendingView);
      setPendingView(null);
    }
  };

  const handleViewClick = (view: "customer" | "kitchen") => {
    if (authToken) {
      setActiveView(view);
    } else {
      setPendingView(view);
      setShowAuthModal(true);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    setActiveView("select");
  };

  if (activeView === "customer") {
    return (
      <CustomerApp
        onLogout={handleLogout}
        onSwitchView={() => setActiveView("select")}
      />
    );
  }

  if (activeView === "kitchen") {
    return (
      <KitchenDashboard
        onLogout={handleLogout}
        onSwitchView={() => setActiveView("select")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-secondary/5 rounded-full blur-3xl -z-10" />

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
      <div className="max-w-2xl w-full space-y-8 text-center relative z-10">
        <div>
          <h1 className="text-4xl font-bold mb-2">Cafe Order System</h1>
          <p className="text-muted-foreground text-lg">
            Choose your interface to get started
          </p>
          {user && (
            <p className="text-sm text-primary mt-2">
              Logged in as: {user.name || user.email || user.phone}
            </p>
          )}
        </div>
        <div className="grid gap-6">
          <button
            onClick={() => handleViewClick("customer")}
            className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg w-full"
          >
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                <ShoppingBag className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Customer App</h2>
              <p className="text-muted-foreground">
                Browse menu, add items to cart, and place your order
              </p>
            </div>
          </button>
          <div className="text-center">
            <Link to="/customer" target="_blank" className="text-sm text-primary underline">Open Customer in new tab</Link>
          </div>
          <button
            onClick={() => handleViewClick("kitchen")}
            className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card p-6 transition-all hover:border-secondary hover:shadow-lg w-full"
          >
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mx-auto group-hover:bg-secondary/20 transition-colors">
                <ChefHat className="w-10 h-10 text-secondary" />
              </div>
              <h2 className="text-2xl font-bold">Kitchen Dashboard</h2>
              <p className="text-muted-foreground">
                Manage orders, update status, and process bills
              </p>
            </div>
          </button>
          <div className="text-center">
            <Link to="/kitchen" target="_blank" className="text-sm text-secondary underline">Open Kitchen in new tab</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
