import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Backend API
const API = (import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:4001";

const fetchMenuItems = async () => {
  try {
    const res = await fetch(`${API}/menu`);
    if (!res.ok) throw new Error("Failed to fetch menu");
    const data = await res.json();
    // flatten into array
    const list: MenuItem[] = [];
    Object.entries(data).forEach(([category, items]: any) => {
      (items || []).forEach((it: any) => list.push({ id: it.id, name: it.name, category, price: it.price, available: it.available ?? true }));
    });
    return list;
  } catch (e) {
    console.warn("Failed to load menu from backend, falling back to local placeholder", e);
    return [];
  }
};

const saveMenuItem = async (item: MenuItem) => {
  try {
    if (!item.id || item.id.startsWith("item-")) {
      const res = await fetch(`${API}/menu`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
      return res.ok ? await res.json() : { success: false };
    }
    const res = await fetch(`${API}/menu/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    return res.ok ? await res.json() : { success: false };
  } catch (e) {
    console.warn("Failed to save menu item", e);
    return { success: false };
  }
};

const deleteMenuItem = async (itemId: string) => {
  try {
    const res = await fetch(`${API}/menu/${itemId}`, { method: "DELETE" });
    return res.ok ? await res.json() : { success: false };
  } catch (e) {
    console.warn("Failed to delete menu item", e);
    return { success: false };
  }
};

type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
};

export const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    available: true,
    newCategory: "",
  });

  useEffect(() => {
    loadMenuItems();
  }, []);

  const loadMenuItems = async () => {
    const items = await fetchMenuItems();
    setMenuItems(items);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.category || !formData.price) {
      toast.error("Please fill all fields");
      return;
    }

    const category = formData.category === "__new__" ? formData.newCategory.trim() : formData.category;
    if (!category) return toast.error("Please provide a category");

    const item: MenuItem = {
      id: editingItem?.id || `item-${Date.now()}`,
      name: formData.name,
      category,
      price: parseFloat(formData.price),
      available: typeof formData.available === "boolean" ? formData.available : (editingItem?.available ?? true),
    };

    await saveMenuItem(item);

    if (editingItem) {
      setMenuItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      toast.success("Menu item updated");
    } else {
      setMenuItems((prev) => [...prev, item]);
      toast.success("Menu item added");
    }

    resetForm();
    setIsDialogOpen(false);
    // notify other tabs (customer view) to refresh menu immediately
    try {
      localStorage.setItem("menu-updated", Date.now().toString());
    } catch (e) {
      /* ignore if localStorage not available */
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      available: item.available ?? true,
      newCategory: "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (itemId: string) => {
    await deleteMenuItem(itemId);
    setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
    toast.success("Menu item deleted");
    try {
      localStorage.setItem("menu-updated", Date.now().toString());
    } catch (e) {}
  };

  const toggleAvailability = async (item: MenuItem) => {
    const updatedItem = { ...item, available: !item.available };
    await saveMenuItem(updatedItem);
    setMenuItems((prev) => prev.map((i) => (i.id === item.id ? updatedItem : i)));
    toast.success(updatedItem.available ? "Item marked available" : "Item marked unavailable");
    try {
      localStorage.setItem("menu-updated", Date.now().toString());
    } catch (e) {}
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({ name: "", category: "", price: "", available: true, newCategory: "" });
  };

  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Menu Management</h2>
          <p className="text-muted-foreground">Add, edit, and manage menu items</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Menu Item" : "Add New Menu Item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Masala Chai"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 rounded border bg-background"
                >
                  <option value="">Select category</option>
                  {Object.keys(groupedItems).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__new__">-- Add new category --</option>
                </select>
                {formData.category === "__new__" && (
                  <div className="mt-2">
                    <Input placeholder="New category name" value={formData.newCategory} onChange={(e) => setFormData({ ...formData, newCategory: e.target.value })} />
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="price">Price (₹)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="e.g., 20"
                />
              </div>
              <div className="flex items-center gap-3">
                <input id="available" type="checkbox" checked={!!formData.available} onChange={(e) => setFormData({ ...formData, available: e.target.checked })} />
                <label htmlFor="available" className="text-sm">Available</label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(false);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedItems).map(([category, items]) => (
          <Card key={category} className="p-6">
            <h3 className="text-xl font-bold mb-4">{category}</h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-lg">{item.name}</span>
                      <Badge
                        className={
                          item.available
                            ? "bg-primary/20 text-primary"
                            : "bg-destructive/20 text-destructive"
                        }
                      >
                        {item.available ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground">₹{item.price}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => toggleAvailability(item)}
                      variant={item.available ? "outline" : "default"}
                      size="sm"
                    >
                      {item.available ? "Mark Unavailable" : "Mark Available"}
                    </Button>
                    <Button onClick={() => handleEdit(item)} variant="outline" size="sm">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(item.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
