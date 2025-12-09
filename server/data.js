// Minimal shared data for the backend (mirrors frontend mock data)
const menuData = {
  Tea: [
    { id: "tea-1", name: "Masala Chai", price: 30, description: "Spiced Indian tea with milk", image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80" },
    { id: "tea-2", name: "Ginger Tea", price: 30, description: "Refreshing tea infused with ginger", image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80" },
    { id: "tea-3", name: "Green Tea", price: 40, description: "Healthy antioxidant-rich tea", image: "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=800&q=80" },
    { id: "tea-4", name: "Black Tea", price: 25, description: "Strong black tea without milk", image: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&q=80" }
  ],
  Snacks: [
    { id: "snack-1", name: "Samosa", price: 20, description: "Crispy pastry filled with spiced potatoes", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80" },
    { id: "snack-2", name: "Pakora", price: 35, description: "Fried vegetable fritters", image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=800&q=80" },
    { id: "snack-3", name: "Vada Pav", price: 25, description: "Spicy potato dumpling in a bun", image: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?q=80" },
    { id: "snack-4", name: "Sandwich", price: 50, description: "Grilled vegetable sandwich", image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80" }
  ],
  Paratha: [
    { id: "paratha-1", name: "Aloo Paratha", price: 60, description: "Flatbread stuffed with spiced potatoes", image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=800&q=80" },
    { id: "paratha-2", name: "Paneer Paratha", price: 80, description: "Flatbread stuffed with cottage cheese", image: "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=800&q=80" },
    { id: "paratha-3", name: "Gobi Paratha", price: 70, description: "Flatbread stuffed with cauliflower", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80" },
    { id: "paratha-4", name: "Mix Paratha", price: 90, description: "Flatbread with mixed vegetables", image: "https://images.unsplash.com/photo-1606491956689-2ea28c674675?w=800&q=80" }
  ]
};

module.exports = { menuData };
