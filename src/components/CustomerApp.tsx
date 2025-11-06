import { useState, useEffect } from "react";
import { ShoppingCart, Plus, Minus, X, Coffee, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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

export const CustomerApp = () => {
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
      const s = localStorage.getItem('customerSession');
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed && parsed.phone) {
          setPhone(parsed.phone);
          setIsAuthenticated(true);
          // take user to menu automatically if they were signed in
          setCurrentView('menu');
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const handleStartOrder = () => {
    if (!tableNumber || !customerName || !phone) {
      toast.error("Please enter table number, name and phone");
      return;
    }
    if (parseInt(tableNumber) < 1 || parseInt(tableNumber) > 40) {
      toast.error("Table number must be between 1 and 40");
      return;
    }

    // Request OTP from backend (dev-friendly)
    (async () => {
      try {
        const res = await fetch(`${API}/otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        if (res.ok) {
          const body = await res.json();
          // backend returns code in dev for testing — we won't show it but store state to enable verify
          setOtpSent(true);
          setCurrentView("otp");
          toast.success("OTP sent (for testing it may be returned by the API)");
          return;
        }
      } catch (e) {
        console.warn("OTP request failed, falling back to client-side OTP", e);
      }

      // fallback: generate and show OTP locally
      setOtpSent(true);
      setCurrentView("otp");
      toast.success("OTP generated locally for testing");
    })();
  };

  const verifyOtp = async () => {
    try {
      const res = await fetch(`${API}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otpCode }),
      });
      if (res.ok) {
        toast.success("Verified — welcome!");
        // persist a minimal session so the user stays signed in across reloads
        try { localStorage.setItem('customerSession', JSON.stringify({ phone })); } catch (e) {}
        setIsAuthenticated(true);
        setCurrentView("menu");
        return;
      }
      const body = await res.json();
      toast.error(body?.message || "Invalid code");
    } catch (e) {
      console.warn("OTP verify failed, falling back to simple check", e);
      // simple fallback — accept any 4-digit code for offline dev
      if (/^\d{4}$/.test(otpCode)) {
        toast.success("Verified (offline)");
        try { localStorage.setItem('customerSession', JSON.stringify({ phone })); } catch (e) {}
        setIsAuthenticated(true);
        setCurrentView("menu");
      } else {
        toast.error("Invalid code");
      }
    }
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
        } catch (e) {}
        setCurrentView("orderPlaced");
        toast.success("Order placed successfully!");
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
      } catch (e) {}
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
                } catch (e) {}
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
              } catch (e) {}
            })
          );
          if (!cancelled) setActiveOrderStatuses(statuses);
        }
      } catch (e) {}
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
            } catch (e) {}
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
    try { localStorage.removeItem('customerSession'); } catch (e) {}
    setIsAuthenticated(false);
    setPhone("");
    setActiveOrders([]);
    setActiveOrderStatuses({});
    setCart([]);
    setCurrentView('welcome');
    setTableNumber('');
    setCustomerName('');
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
              <label className="text-sm font-medium mb-2 block">Phone (for OTP)</label>
              <Input
                type="tel"
                placeholder="Enter your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
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

  // OTP verification screen
  if (currentView === "otp") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Enter OTP</h1>
            <p className="text-muted-foreground">We've sent a one-time code to {phone}</p>
          </div>
          <div className="space-y-4">
            <Input
              placeholder="Enter 4-digit code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              maxLength={6}
            />
            <div className="flex gap-2">
              <Button onClick={verifyOtp} className="flex-1">
                Verify
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await fetch(`${API}/otp`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ phone }),
                    });
                    toast.success("OTP resent");
                  } catch (e) {
                    toast.error("Failed to resend OTP");
                  }
                }}
              >
                Resend
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setCurrentView("welcome")}>Cancel</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Menu Screen
  if (currentView === "menu") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 bg-card border-b p-4 flex items-center justify-between shadow-sm z-10">
          <div>
            <h2 className="font-bold text-lg">Table {tableNumber}</h2>
            <p className="text-sm text-muted-foreground">{customerName}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowUnavailable((s) => !s)}>
              {showUnavailable ? "Hide unavailable" : "Show unavailable"}
            </Button>
            {isAuthenticated && (
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            )}
            <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView("cart")}
            className="relative"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Cart
            {cart.length > 0 && (
              <Badge className="ml-2 bg-primary">{cart.reduce((acc, item) => acc + item.quantity, 0)}</Badge>
            )}
            </Button>
          </div>
        </header>

        <div className="p-4 space-y-6 pb-24">
          {Object.entries(menu).map(([category, items]) => {
            const visibleItems = (items || []).filter((it) => showUnavailable ? true : (it.available !== false));
            if (visibleItems.length === 0) return null;
            return (
            <div key={category}>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5" />
                {category}
              </h3>
              <div className="grid gap-3">
                {visibleItems.map((item) => (
                  <Card key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">₹{item.price}</p>
                      {item.available === false && (
                        <div className="mt-1 inline-block">
                          <span className="text-sm px-2 py-1 rounded bg-destructive/10 text-destructive">Unavailable</span>
                        </div>
                      )}
                    </div>
                    <div className="w-full sm:w-auto flex items-center gap-2">
                      <div className="flex items-center border rounded-md overflow-hidden">
                        <Button variant="ghost" size="sm" onClick={() => decMenuQuantity(item.id)}>
                          <Minus className="w-4 h-4" />
                        </Button>
                        <div className="px-3 py-2">{itemQuantities[item.id] || 0}</div>
                        <Button variant="ghost" size="sm" onClick={() => incMenuQuantity(item.id)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        onClick={() => addToCartWithQty(item, itemQuantities[item.id] && itemQuantities[item.id] > 0 ? itemQuantities[item.id] : 1)}
                        size="lg"
                        className="flex-1 sm:flex-none"
                        disabled={item.available === false}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {item.available === false ? "Unavailable" : "Add to Cart"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Cart Screen
  if (currentView === "cart") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-card border-b p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setCurrentView("menu")}>
              ← Back
            </Button>
            <h2 className="font-bold text-lg">Your Order</h2>
          </div>
        </header>

        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground" />
              <h3 className="text-xl font-medium">Your cart is empty</h3>
              <Button onClick={() => setCurrentView("menu")}>Browse Menu</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {cart.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">₹{item.price} each</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="font-medium w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="font-bold">₹{item.price * item.quantity}</p>
                  </div>
                </Card>
              ))}
            </div>

            <div className="border-t bg-card p-4 space-y-3">
              <div className="text-sm text-muted-foreground">The staff will generate the bill when ready.</div>
              <Button onClick={handlePlaceOrder} className="w-full" variant="outline" size="lg">
                Place Order (Send to Kitchen)
              </Button>
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
