
export interface Measure {
  id: string;
  measureControl: string; 
  measureUnit: string;    
  measureMultiplier: number; 
  userId: string;
  householdId: string;
}

export interface Category {
  id: string;
  name: string;
  userId: string;
  householdId: string;
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  measureId: string;
  measureControl: string;
  measureUnit: string;
  minimumStock: number;
  targetStock: number;
  currentStock: number;
  productsQuantity: number;
  userId: string;
  householdId: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  unitQuantity: number;
  measureId: string;
  measureControl: string;
  measureUnit: string;
  nameInApp: string;
  allowed: boolean;
  comments: string;
  userId: string;
  householdId: string;
  lastPrice?: number;
}

export interface Movement {
  id: string;
  type: 'entrada' | 'saída' | 'ajuste';
  origin: 'compra' | 'consumo' | 'manual';
  dateTime: any;
  subcategoryId: string;
  subcategoryName: string;
  categoryId: string;
  categoryName: string;
  productId?: string;
  productName?: string;
  quantity: number; 
  displayQuantity: string;
  userId: string;
  householdId: string;
  value?: number;
  location?: string; // Novo: Local da compra
}

export interface CartItem {
  id: string;
  subcategoryId: string;
  subcategoryName?: string;
  productId: string;
  productName?: string;
  productQuantity: number;
  quantity: number; 
  unit?: string;
  unitPrice: number;
  userId: string;
  householdId: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  householdId: string;
  displayName?: string;
}
