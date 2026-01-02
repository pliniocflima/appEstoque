
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  writeBatch,
  serverTimestamp,
  getDocs,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Measure, Product, Movement, CartItem, UserProfile } from '../types';

// Gestão de Perfil e Casa
export const getOrCreateProfile = async (uid: string, email: string | null): Promise<UserProfile> => {
  const ref = doc(db, 'profiles', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserProfile;
  
  const newProfile = { uid, email, householdId: uid }; 
  await setDoc(ref, newProfile);
  return newProfile;
};

export const updateHousehold = async (uid: string, householdId: string) => {
  await updateDoc(doc(db, 'profiles', uid), { householdId });
};

export const subscribeToCollection = (
  colName: string, 
  householdId: string, 
  callback: (data: any[]) => void
) => {
  if (!householdId) return () => {};
  const q = query(collection(db, colName), where("householdId", "==", householdId));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(items);
  });
};

export const updateItem = async (colName: string, id: string, data: any) => {
  await updateDoc(doc(db, colName, id), data);
};

export const deleteItem = async (colName: string, id: string) => {
  await deleteDoc(doc(db, colName, id));
};

export const deleteMovementWithReversal = async (movement: Movement) => {
  const batch = writeBatch(db);
  const subRef = doc(db, 'subcategories', movement.subcategoryId);
  const subSnap = await getDoc(subRef);
  
  if (subSnap.exists()) {
    const subData = subSnap.data();
    const currentStock = Number(subData.currentStock) || 0;
    // Reversão: subtrai o que foi somado ou soma o que foi subtraído
    const reversedStock = currentStock - (Number(movement.quantity) || 0);
    batch.update(subRef, { currentStock: Math.max(0, reversedStock) });
  }
  
  batch.delete(doc(db, 'movements', movement.id));
  await batch.commit();
};

export const addMeasure = async (userId: string, householdId: string, data: any) => {
  await addDoc(collection(db, 'measures'), { ...data, userId, householdId });
};

export const addCategory = async (userId: string, householdId: string, name: string) => {
  await addDoc(collection(db, 'categories'), { name, userId, householdId });
};

export const addSubcategory = async (userId: string, householdId: string, data: any) => {
  await addDoc(collection(db, 'subcategories'), { ...data, userId, householdId });
};

export const addProduct = async (userId: string, householdId: string, data: any) => {
  await addDoc(collection(db, 'products'), { ...data, userId, householdId });
};

export const addToCart = async (userId: string, householdId: string, item: any) => {
  await addDoc(collection(db, 'cart'), { ...item, userId, householdId });
};

export const updateCartItem = async (id: string, data: any) => {
  await updateDoc(doc(db, 'cart', id), data);
};

export const removeFromCart = async (id: string) => {
  await deleteDoc(doc(db, 'cart', id));
};

export const updateStockWithLog = async (userId: string, householdId: string, movement: any, newStock: number) => {
  const batch = writeBatch(db);
  batch.update(doc(db, 'subcategories', movement.subcategoryId), { currentStock: newStock });
  batch.set(doc(collection(db, 'movements')), { ...movement, userId, householdId, dateTime: movement.dateTime || serverTimestamp() });
  await batch.commit();
};

export const processPurchase = async (
  userId: string, 
  householdId: string, 
  cart: CartItem[], 
  subcategories: any[], 
  products: any[], 
  measures: any[],
  purchaseDate: Date,
  location: string
) => {
  const batch = writeBatch(db);
  const finalTimestamp = Timestamp.fromDate(purchaseDate);

  for (const item of cart) {
    const sub = subcategories.find(s => s.id === item.subcategoryId);
    const prod = products.find(p => p.id === item.productId);
    
    if (sub) {
      const itemQty = Number(item.quantity) || 0;
      const itemPrice = Number(item.unitPrice) || 0;
      
      let addedQty = 0;
      let displaySuffix = '';

      if (prod) {
        addedQty = itemQty * (Number(prod.unitQuantity) || 1);
        displaySuffix = `+${itemQty} un de ${prod.name}`;
      } else {
        const unitToUse = item.unit || sub.measureUnit;
        const measureObj = measures.find(m => m.measureUnit === unitToUse);
        const multiplier = measureObj ? Number(measureObj.measureMultiplier) : 1;
        addedQty = itemQty * multiplier;
        displaySuffix = `+${itemQty} ${unitToUse}`;
      }

      const newStock = (Number(sub.currentStock) || 0) + addedQty;
      const subRef = doc(db, 'subcategories', sub.id);
      batch.update(subRef, { currentStock: newStock, isOnShoppingList: false });

      const movRef = doc(collection(db, 'movements'));
      batch.set(movRef, {
        userId, 
        householdId, 
        type: 'entrada', 
        origin: 'compra', 
        dateTime: finalTimestamp,
        subcategoryId: sub.id, 
        subcategoryName: sub.name, 
        categoryId: sub.categoryId, 
        categoryName: sub.categoryName,
        productId: prod?.id || null, 
        productName: prod?.name || 'Genérico',
        quantity: addedQty, 
        displayQuantity: displaySuffix,
        value: itemQty * itemPrice,
        location: location || 'Não informado'
      });
      
      if (prod) {
        const prodRef = doc(db, 'products', prod.id);
        batch.update(prodRef, { lastPrice: itemPrice });
      }
    }
  }

  const q = query(collection(db, 'cart'), where("householdId", "==", householdId));
  const snap = await getDocs(q);
  snap.docs.forEach(d => batch.delete(d.ref));

  try {
    await batch.commit();
  } catch (error) {
    console.error("Erro ao executar commit do batch:", error);
    throw error;
  }
};

export const toggleShoppingList = async (id: string, status: boolean) => {
  await updateDoc(doc(db, 'subcategories', id), { isOnShoppingList: status });
};
