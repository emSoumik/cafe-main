import { useState } from "react";
import { Link } from "react-router-dom";
import { CustomerApp } from "@/components/CustomerApp";
import { KitchenDashboard } from "@/components/KitchenDashboard";
import { Button } from "@/components/ui/button";
import { ChefHat, ShoppingBag } from "lucide-react";

const Index = () => {
  const [activeView, setActiveView] = useState<"select" | "customer" | "kitchen">("select");

  if (activeView === "customer") {
    return (
      <div>
        <div className="fixed top-4 right-4 z-50">
          <Button variant="outline" onClick={() => setActiveView("select")}>
            Switch View
          </Button>
        </div>
        <CustomerApp />
      </div>
    );
  }

  if (activeView === "kitchen") {
    return (
      <div>
        <div className="fixed top-4 right-4 z-50">
          <Button variant="outline" onClick={() => setActiveView("select")}>
            Switch View
          </Button>
        </div>
        <KitchenDashboard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Cafe Order System</h1>
          <p className="text-muted-foreground text-lg">
            Choose your interface to get started
          </p>
        </div>
        <div className="grid gap-6">
          <button
            onClick={() => setActiveView("customer")}
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
            onClick={() => setActiveView("kitchen")}
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
