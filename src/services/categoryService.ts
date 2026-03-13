import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

// ── Types ──────────────────────────────────────────────

export interface SubSubCategory {
  id?: string;
  name: string;
  slug: string;
}

export interface SubCategory {
  id?: string;
  name: string;
  slug: string;
  children?: SubSubCategory[];
}

export interface Category {
  id?: string;
  name: string;
  slug: string;
  subcategories: SubCategory[];
  createdAt?: any;
  updatedAt?: any;
}

// ── Default categories (seeded on first load if collection empty) ──

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Jewellery',
    slug: 'jewellery',
    subcategories: [
      { name: 'Womens', slug: 'womens', children: [{ name: 'Rings', slug: 'rings' }, { name: 'Necklace', slug: 'necklace' }] },
      { name: 'Mens', slug: 'mens', children: [] },
      { name: 'Wedding', slug: 'wedding', children: [] },
    ],
  },
  {
    name: 'Furniture',
    slug: 'furniture',
    subcategories: [
      { name: 'Home', slug: 'home', children: [] },
      { name: 'Sofa', slug: 'sofa', children: [] },
    ],
  },
  {
    name: 'Articles',
    slug: 'articles',
    subcategories: [
      { name: 'Gifting', slug: 'gifting', children: [] },
      { name: 'Pooja Items', slug: 'pooja-items', children: [] },
    ],
  },
  {
    name: 'Others',
    slug: 'others',
    subcategories: [],
  },
];

const CATEGORIES_COLLECTION = 'categories';

// ── Helpers ────────────────────────────────────────────

export const toSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ── CRUD ───────────────────────────────────────────────

export const seedDefaultCategories = async (): Promise<void> => {
  const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
  if (!snapshot.empty) return; // already seeded

  for (const cat of DEFAULT_CATEGORIES) {
    await addDoc(collection(db, CATEGORIES_COLLECTION), {
      ...cat,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
};

export const getCategories = async (): Promise<Category[]> => {
  const snapshot = await getDocs(
    query(collection(db, CATEGORIES_COLLECTION), orderBy('createdAt', 'asc'))
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
};

export const subscribeToCategories = (callback: (cats: Category[]) => void) => {
  const q = query(collection(db, CATEGORIES_COLLECTION), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const cats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
    callback(cats);
  });
};

export const addCategory = async (name: string): Promise<string> => {
  const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), {
    name,
    slug: toSlug(name),
    subcategories: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateCategory = async (categoryId: string, data: Partial<Category>): Promise<void> => {
  await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
  await deleteDoc(doc(db, CATEGORIES_COLLECTION, categoryId));
};

// ── Subcategory helpers ────────────────────────────────

export const addSubcategory = async (
  categoryId: string,
  currentSubs: SubCategory[],
  name: string
): Promise<void> => {
  const newSub: SubCategory = { name, slug: toSlug(name), children: [] };
  await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryId), {
    subcategories: [...currentSubs, newSub],
    updatedAt: serverTimestamp(),
  });
};

export const removeSubcategory = async (
  categoryId: string,
  currentSubs: SubCategory[],
  subSlug: string
): Promise<void> => {
  await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryId), {
    subcategories: currentSubs.filter((s) => s.slug !== subSlug),
    updatedAt: serverTimestamp(),
  });
};

// ── Sub-sub-category helpers ───────────────────────────

export const addSubSubcategory = async (
  categoryId: string,
  currentSubs: SubCategory[],
  subSlug: string,
  name: string
): Promise<void> => {
  const updated = currentSubs.map((s) => {
    if (s.slug === subSlug) {
      return { ...s, children: [...(s.children || []), { name, slug: toSlug(name) }] };
    }
    return s;
  });
  await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryId), {
    subcategories: updated,
    updatedAt: serverTimestamp(),
  });
};

export const removeSubSubcategory = async (
  categoryId: string,
  currentSubs: SubCategory[],
  subSlug: string,
  childSlug: string
): Promise<void> => {
  const updated = currentSubs.map((s) => {
    if (s.slug === subSlug) {
      return { ...s, children: (s.children || []).filter((c) => c.slug !== childSlug) };
    }
    return s;
  });
  await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryId), {
    subcategories: updated,
    updatedAt: serverTimestamp(),
  });
};
