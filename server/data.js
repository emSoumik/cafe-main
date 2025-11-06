// Minimal shared data for the backend (mirrors frontend mock data)
const menuData = {
  Tea: [
    { id: "tea-1", name: "Masala Chai", price: 30 },
    { id: "tea-2", name: "Ginger Tea", price: 30 },
    { id: "tea-3", name: "Green Tea", price: 40 },
    { id: "tea-4", name: "Black Tea", price: 25 }
  ],
  Snacks: [
    { id: "snack-1", name: "Samosa", price: 20 },
    { id: "snack-2", name: "Pakora", price: 35 },
    { id: "snack-3", name: "Vada Pav", price: 25 },
    { id: "snack-4", name: "Sandwich", price: 50 }
  ],
  Paratha: [
    { id: "paratha-1", name: "Aloo Paratha", price: 60 },
    { id: "paratha-2", name: "Paneer Paratha", price: 80 },
    { id: "paratha-3", name: "Gobi Paratha", price: 70 },
    { id: "paratha-4", name: "Mix Paratha", price: 90 }
  ]
};

module.exports = { menuData };
