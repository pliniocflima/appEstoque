export interface Category {
  id: string;
  name: string;
  userId: string;
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string; // Helper for display
  currentStock: number;
  targetStock: number;
  unit: string;
  userId: string;
  isOnShoppingList?: boolean; // If manually added to list
}

export interface Product {
  id: string;
  name: string;
  subcategoryId: string;
  userId: string;
  lastPrice?: number;
}

export interface CartItem {
  id: string; // temporary unique id for the cart row
  subcategoryId: string;
  subcategoryName: string;
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  unit: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
}