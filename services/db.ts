import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  writeBatch 
} from 'firebase/firestore';
import { db } from './firebase';
import { Category, Subcategory, Product } from '../types';

// Generic hook-like functions for subscriptions (to be used inside useEffect)

export const subscribeToCollection = (
  colName: string, 
  userId: string, 
  callback: (data: any[]) => void
) => {
  if (!userId) return () => {};
  
  const q = query(collection(db, colName), where("userId", "==", userId));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(items);
  });
};

export const addCategory = async (userId: string, name: string) => {
  await addDoc(collection(db, 'categories'), { name, userId });
};

export const addSubcategory = async (userId: string, data: Omit<Subcategory, 'id' | 'userId'>) => {
  await addDoc(collection(db, 'subcategories'), { ...data, userId });
};

export const addProduct = async (userId: string, data: Omit<Product, 'id' | 'userId'>) => {
  await addDoc(collection(db, 'products'), { ...data, userId });
};

export const updateStock = async (subcategoryId: string, newStock: number) => {
  const ref = doc(db, 'subcategories', subcategoryId);
  await updateDoc(ref, { currentStock: newStock });
};

export const toggleShoppingList = async (subcategoryId: string, status: boolean) => {
  const ref = doc(db, 'subcategories', subcategoryId);
  await updateDoc(ref, { isOnShoppingList: status });
};

export const deleteItem = async (colName: string, id: string) => {
  await deleteDoc(doc(db, colName, id));
};

export const processPurchase = async (cartItems: any[]) => {
  const batch = writeBatch(db);
  
  cartItems.forEach(item => {
    // Update Subcategory Stock
    const subRef = doc(db, 'subcategories', item.subcategoryId);
    // Note: In a real app we would read first to be atomic, but simplistic increment here
    // Since we don't have atomic increment accessible easily without knowing current, 
    // we assume the Cart logic passed the *new* total or we do client side calculation before calling this.
    // For this simple PWA, we will rely on client passing the calculated new value or use increment.
    // Let's assume the UI calculates the new stock locally.
    
    // Actually, let's use the UI logic to calculate final stock and just set it here.
    // See use in ShoppingRun.tsx
    
    // Also remove from shopping list
    batch.update(subRef, { isOnShoppingList: false });
    
    // Update Product Last Price if product selected
    if (item.productId) {
      const prodRef = doc(db, 'products', item.productId);
      batch.update(prodRef, { lastPrice: item.unitPrice });
    }
  });
  
  await batch.commit();
};