// Order rows for the admin Customers list and Customer details. Orders live in
// the top-level `orders` collection, tied to the customer by `userId`.

export interface CustomerOrder {
  id: string;
  orderNumber?: string;
  status: string;
  total: number;
  items: any[];
  createdAt: any;
}

export const toCustomerOrder = (id: string, data: Record<string, any>): CustomerOrder => ({
  id,
  orderNumber: data.orderId,
  status: data.status || 'pending',
  total: typeof data.total === 'number' ? data.total : 0,
  items: Array.isArray(data.items) ? data.items : [],
  createdAt: data.createdAt,
});

const newestFirst = (a: CustomerOrder, b: CustomerOrder) =>
  (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);

export const toCustomerOrders = (rows: { id: string; data: Record<string, any> }[]): CustomerOrder[] =>
  rows.map((r) => toCustomerOrder(r.id, r.data)).sort(newestFirst);

export const groupOrdersByCustomer = (rows: { id: string; data: Record<string, any> }[]) => {
  const byCustomer = new Map<string, CustomerOrder[]>();
  for (const r of rows) {
    const userId = r.data.userId;
    if (!userId) continue;
    const list = byCustomer.get(userId) || [];
    list.push(toCustomerOrder(r.id, r.data));
    byCustomer.set(userId, list);
  }
  byCustomer.forEach((list) => list.sort(newestFirst));
  return byCustomer;
};

// "Spent" counts delivered orders only, so cancelled and pending ones don't inflate it.
export const totalSpent = (orders: CustomerOrder[]) =>
  orders.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);
