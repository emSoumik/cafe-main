import { useState, useEffect } from "react";
import { ShoppingCart, Plus, Minus, X, Coffee, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, ArrowRightLeft, MoreVertical, Bell } from "lucide-react";
import { requestNotificationPermission, showNotification } from "@/lib/notifications";

interface CustomerAppProps {
  onLogout: () => void;
  onSwitchView: () => void;
}

// API URL (set via Vite env or fallback)
const API = (import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:4001";

// Placeholder fallback functions (used if backend unavailable)
const placeOrderFallback = async (orderData: any) => {
  console.log("Placing order (fallback):", orderData);
  return { success: true, orderId: `ORD-${Date.now()}` };
};

const requestBillFallback = async (orderId: string) => {
  console.log("Requesting bill (fallback) for:", orderId);
  return { success: true };
};

// NOTE: Removed inline/mock menu data so the app always loads menu from the backend.
// If the backend is unavailable the menu will be empty and the UI will show no items.

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export const CustomerApp = ({ onLogout, onSwitchView }: CustomerAppProps) => {
  const [currentView, setCurrentView] = useState<"welcome" | "otp" | "menu" | "cart" | "orderPlaced">("welcome");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderId, setOrderId] = useState("");
  type MenuMap = Record<string, { id: string; name: string; price: number; available?: boolean }[]>;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // initialize menu as empty — we rely on backend /menu
  const [menu, setMenu] = useState<MenuMap>({} as MenuMap);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const [activeOrders, setActiveOrders] = useState<string[]>([]);
  const [activeOrderStatuses, setActiveOrderStatuses] = useState<Record<string, any>>({});
  const [showUnavailable, setShowUnavailable] = useState(false);

  // Restore session (if any) on mount so user stays signed in across reloads
  useEffect(() => {
    try {
      // Check global auth first
      const globalAuth = localStorage.getItem('user_data');
      if (globalAuth) {
        const user = JSON.parse(globalAuth);
        if (user.phone) setPhone(user.phone);
        if (user.name) setCustomerName(user.name);
        setIsAuthenticated(true);
        // If we have phone, we can skip straight to menu if table number is set, 
        // but usually we still need table number.
        // So we stay on welcome screen but pre-fill phone and hide the phone input.
      }
    } catch (e) {
      // ignore
    }

    // Request notification permission
    requestNotificationPermission().then(permission => {
      if (permission === 'granted') {
        console.log('Notification permission granted');
      }
    });
  }, []);

  const handleStartOrder = () => {
    if (!tableNumber || !customerName) {
      toast.error("Please enter table number and name");
      return;
    }
    if (parseInt(tableNumber) < 1 || parseInt(tableNumber) > 40) {
      toast.error("Table number must be between 1 and 40");
      return;
    }

    // If already authenticated (globally), skip OTP
    if (isAuthenticated) {
      setCurrentView("menu");
      return;
    }

    // Fallback for unauthenticated flow (shouldn't happen with new Index.tsx logic, but keeping for safety)
    if (!phone) {
      toast.error("Phone number required");
      return;
    }

    // ... existing OTP logic would go here if we needed it, but we are removing it ...
    // For now, just proceed if phone is present (legacy fallback)
    setCurrentView("menu");
  };

  const addToCart = (item: any) => {
    // default add 1
    const qty = 1;
    const existingItem = cart.find((cartItem) => cartItem.id === item.id);
    if (existingItem) {
      setCart(
        cart.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + qty } : cartItem
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: qty }]);
    }
    toast.success(`${item.name} added to cart`);
  };

  const addToCartWithQty = (item: any, qty = 1) => {
    if (qty <= 0) return toast.error("Quantity must be at least 1");
    const existingItem = cart.find((cartItem) => cartItem.id === item.id);
    if (existingItem) {
      setCart(
        cart.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + qty } : cartItem
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: qty }]);
    }
    // reset quantity control
    setItemQuantities((s) => ({ ...s, [item.id]: 0 }));
    toast.success(`${item.name} x${qty} added to cart`);
  };

  const incMenuQuantity = (id: string) =>
    setItemQuantities((s) => ({ ...s, [id]: (s[id] || 0) + 1 }));
  const decMenuQuantity = (id: string) =>
    setItemQuantities((s) => ({ ...s, [id]: Math.max(0, (s[id] || 0) - 1) }));

  const updateQuantity = (id: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    const orderData = {
      tableNumber: parseInt(tableNumber),
      customerName,
      items: cart,
      totalAmount: getTotalAmount(),
      status: "PENDING",
      timestamp: Date.now(),
    };

    // Try backend first, fall back to local placeholder
    try {
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      if (res.ok) {
        const body = await res.json();
        const newOrderId = body.orderId || `ORD-${Date.now()}`;
        setOrderId(newOrderId);
        // persist active order locally so customer returns can see pending orders
        try {
          // Persist active orders per-authenticated-phone so unauthenticated users don't see others'
          const key = `activeOrders:${phone}`;
          const existing = JSON.parse(localStorage.getItem(key) || "[]");
          const next = Array.from(new Set([...(existing || []), newOrderId]));
          localStorage.setItem(key, JSON.stringify(next));
          setActiveOrders(next);
        } catch (e) { }
        setCurrentView("orderPlaced");
        toast.success("Order placed successfully!");
        showNotification('Order Placed! 🎉', {
          body: `Your order #${newOrderId} has been sent to the kitchen`,
          tag: 'order-placed'
        });
        setPollingStatus("PENDING");
        return;
      }
      // otherwise fall through to fallback
      console.warn("Order POST failed, using fallback");
    } catch (e) {
      console.warn("Order POST error, using fallback:", e);
    }

    const result = await placeOrderFallback(orderData);
    if (result.success) {
      const newOrderId = result.orderId;
      setOrderId(newOrderId);
      try {
        const key = `activeOrders:${phone}`;
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        const next = Array.from(new Set([...(existing || []), newOrderId]));
        localStorage.setItem(key, JSON.stringify(next));
        setActiveOrders(next);
      } catch (e) { }
      setCurrentView("orderPlaced");
      toast.success("Order placed successfully! (offline)");
      setPollingStatus("PENDING");
    }
  };



  // Fetch menu from backend (with local fallback) and poll periodically so customer sees admin edits
  useEffect(() => {
    let cancelled = false;
    let iv: number | undefined;
    let firstLoad = true;

    const fetchMenu = async () => {
      // only show loading indicator on initial fetch
      if (firstLoad) setLoadingMenu(true);
      try {
        const res = await fetch(`${API}/menu`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setMenu(data);
        }
      } catch (e) {
        console.warn("Failed to fetch menu from backend, using local menu", e);
      } finally {
        if (!cancelled && firstLoad) setLoadingMenu(false);
        firstLoad = false;
      }
    };

    // initial fetch
    fetchMenu();

    // Poll for changes while the customer is viewing the menu so admin edits show up without manual refresh
    // Poll interval is moderate to avoid excessive requests (10s)
    if (currentView === "menu") {
      iv = window.setInterval(fetchMenu, 10000);
    }

    // If the view changes, restart polling according to the new view (this effect depends on currentView)
    return () => {
      cancelled = true;
      if (iv) clearInterval(iv);
    };
  }, [currentView]);

  // Poll order status when in orderPlaced view (so customer gets updates)
  useEffect(() => {
    if (currentView !== "orderPlaced" || !orderId) return;
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(`${API}/orders/${orderId}`);
        if (!active) return;
        if (res.ok) {
          const order = await res.json();
          if (order.status && order.status !== pollingStatus) {
            setPollingStatus(order.status);
            toast(`Order status: ${order.status.replace("_", " ")}`);

            // Show notification for status changes
            if (order.status === "PREPARING") {
              showNotification('Order Accepted! 👨‍🍳', {
                body: `Your order #${orderId} is being prepared`,
                tag: 'order-preparing'
              });
            } else if (order.status === "READY") {
              showNotification('Order Ready! ✅', {
                body: `Your order #${orderId} is ready for pickup`,
                tag: 'order-ready',
                requireInteraction: true // Keep notification until user interacts
              });
            }
            // If completed, reset after short delay
            if (order.status === "COMPLETED") {
              setTimeout(() => {
                setCart([]);
                setTableNumber("");
                setCustomerName("");
                setOrderId("");
                setCurrentView("welcome");
                setPollingStatus(null);
                // remove from activeOrders
                try {
                  const key = `activeOrders:${phone}`;
                  const existing = JSON.parse(localStorage.getItem(key) || "[]");
                  const next = (existing || []).filter((id) => id !== orderId);
                  localStorage.setItem(key, JSON.stringify(next));
                  setActiveOrders(next);
                } catch (e) { }
              }, 3000);
            }
          }
        }
      } catch (e) {
        // ignore polling errors
      }
    };

    // initial check and interval
    check();
    const iv = setInterval(check, 5000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [currentView, orderId, pollingStatus]);

  // Load active orders from localStorage only after authentication, and periodically refresh their statuses
  useEffect(() => {
    if (!isAuthenticated || !phone) return;
    let cancelled = false;
    const loadActive = async () => {
      try {
        const key = `activeOrders:${phone}`;
        const stored = JSON.parse(localStorage.getItem(key) || "[]");
        if (stored && stored.length) {
          setActiveOrders(stored);
          const statuses: Record<string, any> = {};
          await Promise.all(
            stored.map(async (id: string) => {
              try {
                const res = await fetch(`${API}/orders/${id}`);
                if (!cancelled && res.ok) {
                  const o = await res.json();
                  statuses[id] = o;
                }
              } catch (e) { }
            })
          );
          if (!cancelled) setActiveOrderStatuses(statuses);
        }
      } catch (e) { }
    };
    loadActive();
    const iv = window.setInterval(loadActive, 10000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [isAuthenticated, phone]);

  // Allow user to manually refresh active orders list
  const refreshActiveOrders = async () => {
    if (!isAuthenticated || !phone) return toast("No active orders");
    try {
      const key = `activeOrders:${phone}`;
      const stored = JSON.parse(localStorage.getItem(key) || "[]");
      if (stored && stored.length) {
        const statuses: Record<string, any> = {};
        await Promise.all(
          stored.map(async (id: string) => {
            try {
              const res = await fetch(`${API}/orders/${id}`);
              if (res.ok) {
                const o = await res.json();
                statuses[id] = o;
              }
            } catch (e) { }
          })
        );
        setActiveOrderStatuses(statuses);
        setActiveOrders(stored);
        toast.success("Active orders refreshed");
      } else {
        toast("No active orders");
      }
    } catch (e) {
      toast.error("Failed to refresh active orders");
    }
  };

  const signOut = () => {
    try { localStorage.removeItem('customerSession'); } catch (e) { }
    setIsAuthenticated(false);
    setPhone("");
    setActiveOrders([]);
    setActiveOrderStatuses({});
    setCart([]);
    setCurrentView('welcome');
    setTableNumber('');
    setCustomerName('');
    onLogout();
  };

  // Listen for cross-tab menu updates (triggered by admin actions) and refresh menu immediately
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "menu-updated") {
        (async () => {
          try {
            const res = await fetch(`${API}/menu`);
            if (res.ok) {
              const data = await res.json();
              setMenu(data);
              toast("Menu updated");
            }
          } catch (err) {
            // ignore
          }
        })();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Welcome Screen
  if (currentView === "welcome") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-2">
            <Coffee className="w-16 h-16 mx-auto text-primary" />
            <h1 className="text-3xl font-bold">Welcome to Our Cafe</h1>
            <p className="text-muted-foreground">Let's get your order started!</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Table Number (1-40)</label>
              <Input
                type="number"
                placeholder="Enter your table number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                min="1"
                max="40"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Your Name</label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Your Name</label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            {!isAuthenticated && (
              <div>
                <label className="text-sm font-medium mb-2 block">Phone (for OTP)</label>
                <Input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}
            <Button onClick={handleStartOrder} className="w-full" size="lg">
              View Menu
            </Button>
            {isAuthenticated && activeOrders && activeOrders.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Your active orders</h3>
                <div className="space-y-2">
                  {activeOrders.map((id) => {
                    const o = activeOrderStatuses[id];
                    return (
                      <div key={id} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                        <div>
                          <div className="font-medium">Order {id}</div>
                          <div className="text-sm text-muted-foreground">{o ? o.status : 'Loading...'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => {
                            setOrderId(id);
                            setCurrentView('orderPlaced');
                            setPollingStatus(o?.status || null);
                          }}>
                            View
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-right mt-2">
                    <Button variant="outline" size="sm" onClick={refreshActiveOrders}>Refresh Orders</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // OTP verification screen removed as it's handled globally now

  // Menu Screen
  if (currentView === "menu") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Coffee className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-sm md:text-base">Table {tableNumber}</h2>
                <p className="text-xs text-muted-foreground">{customerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowUnavailable((s) => !s)} className="hidden md:flex text-xs">
                {showUnavailable ? "Hide unavailable" : "Show unavailable"}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentView("cart")}
                className="relative rounded-full hover:bg-primary/10"
              >
                <ShoppingCart className="w-5 h-5" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                    {cart.reduce((acc, item) => acc + item.quantity, 0)}
                  </span>
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowUnavailable((s) => !s)} className="md:hidden">
                    <UtensilsCrossed className="mr-2 h-4 w-4" />
                    {showUnavailable ? "Hide unavailable" : "Show unavailable"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSwitchView}>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Switch View
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => showNotification("Test Notification", { body: "This is a test!" })}>
                    <Bell className="mr-2 h-4 w-4" />
                    Test Notification
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="relative h-48 md:h-64 w-full overflow-hidden shrink-0">
          <img
            src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=80"
            alt="Cafe Banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-background to-transparent pt-20">
            <div className="max-w-5xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">Good Morning, {customerName}</h1>
              <p className="text-muted-foreground">What are you craving today?</p>
            </div>
          </div>
        </div>

        {/* Category Nav */}
        <div className="sticky top-[61px] z-40 bg-background/95 backdrop-blur border-b py-3 px-4 overflow-x-auto flex gap-2 no-scrollbar shadow-sm">
          <div className="max-w-5xl mx-auto flex gap-2 w-full">
            {Object.keys(menu).map(cat => (
              <Button
                key={cat}
                variant="outline"
                className="rounded-full whitespace-nowrap border-muted-foreground/20 hover:border-primary hover:text-primary"
                onClick={() => {
                  const el = document.getElementById(`cat-${cat}`);
                  if (el) {
                    const headerOffset = 130;
                    const elementPosition = el.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                  }
                }}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-8 pb-32 max-w-5xl mx-auto min-h-screen">
          {Object.entries(menu).map(([category, items]) => {
            const visibleItems = (items || []).filter((it) => showUnavailable ? true : (it.available !== false));
            if (visibleItems.length === 0) return null;
            return (
              <div key={category} id={`cat-${category}`} className="space-y-4 scroll-mt-32">
                <h3 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {visibleItems.map((item: any) => {
                    const qty = cart.find(i => i.id === item.id)?.quantity || 0;
                    return (
                      <div key={item.id} className="group flex gap-4 p-4 rounded-xl border bg-card/50 hover:bg-card transition-all hover:shadow-md">
                        <div className="flex-1 flex flex-col justify-between space-y-2">
                          <div>
                            <h4 className="font-semibold text-lg leading-tight">{item.name}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.description || "Delicious and freshly prepared."}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <p className="font-medium text-foreground">₹{item.price}</p>
                            {item.available === false && (
                              <Badge variant="destructive" className="text-[10px]">Unavailable</Badge>
                            )}
                          </div>
                        </div>

                        <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-secondary/20 text-muted-foreground">
                              <Coffee className="w-8 h-8 opacity-20" />
                            </div>
                          )}

                          <div className="absolute bottom-2 right-2">
                            {qty > 0 ? (
                              <div className="flex items-center bg-background rounded-full shadow-lg border p-0.5 h-8">
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-secondary/30" onClick={() => updateQuantity(item.id, -1)}>
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="w-6 text-center font-medium text-xs">{qty}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-secondary/30" onClick={() => addToCart(item)}>
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="icon"
                                className="h-8 w-8 rounded-full shadow-lg"
                                onClick={() => addToCart(item)}
                                disabled={item.available === false}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Add to Cart Actions for this category? No, per item is better. 
                    Let's add a small "Add to Order" button if quantity > 0 for the item 
                */}
              </div>
            );
          })}
        </div>

        {/* Floating Cart Bar */}
        {cart.length > 0 && (
          <div className="fixed bottom-4 left-4 right-4 z-50 max-w-5xl mx-auto">
            <Button
              onClick={() => setCurrentView("cart")}
              className="w-full h-14 rounded-2xl shadow-xl text-lg flex justify-between items-center px-6 animate-in slide-in-from-bottom-4"
              size="lg"
            >
              <div className="flex items-center gap-2">
                <div className="bg-primary-foreground/20 px-2 py-0.5 rounded text-sm font-semibold">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </div>
                <span className="font-medium">View Cart</span>
              </div>
              <span className="font-bold">₹{getTotalAmount()}</span>
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Cart Screen
  if (currentView === "cart") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView("menu")} className="rounded-full">
                <ArrowRightLeft className="w-4 h-4 mr-2 rotate-180" /> Back to Menu
              </Button>
            </div>
            <h2 className="font-semibold text-lg">Your Order</h2>
          </div>
        </header>

        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-sm mx-auto">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                <ShoppingCart className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">Your cart is empty</h3>
              <p className="text-muted-foreground">Looks like you haven't added anything yet.</p>
              <Button onClick={() => setCurrentView("menu")} size="lg" className="rounded-full px-8">
                Browse Menu
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 p-4 md:p-6 space-y-4 overflow-y-auto pb-32 max-w-3xl mx-auto w-full">
              {cart.map((item) => (
                <Card key={item.id} className="p-4 border-0 bg-card/50 shadow-sm flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">₹{item.price} each</p>
                  </div>

                  <div className="flex items-center gap-3 bg-background rounded-full border p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQuantity(item.id, -1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="font-medium w-6 text-center text-sm">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQuantity(item.id, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="text-right min-w-[80px]">
                    <p className="font-bold">₹{item.price * item.quantity}</p>
                  </div>

                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeFromCart(item.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                </Card>
              ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 md:p-6 z-40">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex justify-between items-center text-lg font-medium">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="text-2xl font-bold">₹{getTotalAmount()}</span>
                </div>
                <Button onClick={handlePlaceOrder} className="w-full rounded-full text-lg h-12 shadow-lg shadow-primary/20" size="lg">
                  Place Order
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }


  // Order Placed Screen
  if (currentView === "orderPlaced") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <svg
              className="w-10 h-10 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Order Placed!</h2>
            <p className="text-muted-foreground">Your order is being processed</p>
            <div className="flex items-center justify-center gap-3">
              <p className="text-sm font-medium text-foreground">Order ID: {orderId}</p>
              {pollingStatus && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-secondary/10 text-secondary">
                  {pollingStatus.replace("_", " ")}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <Button
              onClick={() => {
                setCurrentView("welcome");
                setCart([]);
                setTableNumber("");
                setCustomerName("");
              }}
              variant="ghost"
              className="w-full"
            >
              Start New Order
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
};
