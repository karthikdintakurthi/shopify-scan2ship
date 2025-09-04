import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Types for Shopify order and Scan2Ship order
interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string;
  total_price: string;
  currency: string;
  customer?: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
  };
  shipping_address?: {
    first_name: string;
    last_name: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    zip: string;
    phone?: string;
  };
  billing_address?: {
    first_name: string;
    last_name: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    zip: string;
    phone?: string;
  };
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    sku?: string;
    weight: number;
    requires_shipping: boolean;
  }>;
  financial_status: string;
  fulfillment_status?: string;
  created_at: string;
  updated_at: string;
}

interface Scan2ShipOrder {
  name: string;
  phones: string[];
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  cod: boolean;
  lineItems: Array<{
    name: string;
    sku?: string;
    quantity: number;
    weight: number;
    value: number;
  }>;
  declaredValue: number;
  currency: string;
  reference: string;
  metadata?: {
    shopifyOrderId: number;
    shopifyOrderNumber: number;
    shop: string;
  };
}

interface OrderMapping {
  shop: string;
  shopifyOrderId: number;
  scan2shipOrderId: string;
  waybill?: string;
  status: 'pending' | 'created' | 'failed';
  createdAt: string;
  updatedAt: string;
}

// Note: HMAC verification is handled by the Shopify authenticate function

// Check Scan2Ship credits balance
async function checkScan2ShipCredits(): Promise<{ balance: number; sufficient: boolean }> {
  try {
    const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/credits`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Scan2Ship credits API error: ${response.status}`);
    }

    const data = await response.json();
    const balance = data.balance || 0;
    const requiredCredits = 1; // Assuming 1 credit per order
    
    return {
      balance,
      sufficient: balance >= requiredCredits
    };
  } catch (error) {
    console.error('Error checking Scan2Ship credits:', error);
    return { balance: 0, sufficient: false };
  }
}

// Map Shopify order to Scan2Ship order format
function mapShopifyOrderToScan2Ship(shopifyOrder: ShopifyOrder, shop: string): Scan2ShipOrder {
  const address = shopifyOrder.shipping_address || shopifyOrder.billing_address;
  
  if (!address) {
    throw new Error('No shipping or billing address found');
  }

  // Determine if COD (Cash on Delivery) is required
  const cod = shopifyOrder.financial_status === 'pending' || 
              shopifyOrder.financial_status === 'partially_paid';

  // Calculate declared value
  const declaredValue = parseFloat(shopifyOrder.total_price);

  // Map line items
  const lineItems = shopifyOrder.line_items
    .filter(item => item.requires_shipping)
    .map(item => ({
      name: item.title,
      sku: item.sku,
      quantity: item.quantity,
      weight: item.weight || 0, // Default weight if not provided
      value: parseFloat(item.price),
    }));

  // Get phone numbers
  const phones = [];
  if (shopifyOrder.customer?.phone) {
    phones.push(shopifyOrder.customer.phone);
  }
  if (address.phone && !phones.includes(address.phone)) {
    phones.push(address.phone);
  }

  return {
    name: `${address.first_name} ${address.last_name}`.trim(),
    phones,
    address: {
      street: `${address.address1}${address.address2 ? `, ${address.address2}` : ''}`.trim(),
      city: address.city,
      state: address.province,
      country: address.country,
      postalCode: address.zip,
    },
    cod,
    lineItems,
    declaredValue,
    currency: shopifyOrder.currency,
    reference: `SHOPIFY-${shopifyOrder.order_number}`,
    metadata: {
      shopifyOrderId: shopifyOrder.id,
      shopifyOrderNumber: shopifyOrder.order_number,
      shop,
    },
  };
}

// Create order in Scan2Ship
async function createScan2ShipOrder(order: Scan2ShipOrder): Promise<{ orderId: string; waybill?: string }> {
  try {
    const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Scan2Ship order creation failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
      orderId: data.orderId || data.id,
      waybill: data.waybill,
    };
  } catch (error) {
    console.error('Error creating Scan2Ship order:', error);
    throw error;
  }
}

// Store order mapping in local storage (in production, use a database)
async function storeOrderMapping(mapping: OrderMapping): Promise<void> {
  try {
    // In a real implementation, this would store to a database
    // For now, we'll just log it
    console.log('Order mapping stored:', mapping);
    
    // TODO: Implement database storage
    // await db.orderMappings.create(mapping);
  } catch (error) {
    console.error('Error storing order mapping:', error);
    throw error;
  }
}

// Retry logic with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Add to dead letter queue for failed orders
async function addToDeadLetterQueue(shop: string, orderId: number, error: Error): Promise<void> {
  try {
    const deadLetterEntry = {
      shop,
      shopifyOrderId: orderId,
      error: error.message,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };
    
    console.log('Adding to dead letter queue:', deadLetterEntry);
    
    // TODO: Implement dead letter queue storage
    // await db.deadLetterQueue.create(deadLetterEntry);
  } catch (error) {
    console.error('Error adding to dead letter queue:', error);
  }
}

// Main order sync function
async function syncOrderToScan2Ship(shopifyOrder: ShopifyOrder, shop: string): Promise<void> {
  try {
    console.log(`Syncing order ${shopifyOrder.id} from ${shop} to Scan2Ship`);

    // Check credits balance
    const credits = await checkScan2ShipCredits();
    if (!credits.sufficient) {
      throw new Error(`Insufficient credits. Balance: ${credits.balance}, Required: 1`);
    }

    // Map Shopify order to Scan2Ship format
    const scan2shipOrder = mapShopifyOrderToScan2Ship(shopifyOrder, shop);

    // Create order in Scan2Ship with retry logic
    const result = await retryWithBackoff(async () => {
      return await createScan2ShipOrder(scan2shipOrder);
    });

    // Store order mapping
    const mapping: OrderMapping = {
      shop,
      shopifyOrderId: shopifyOrder.id,
      scan2shipOrderId: result.orderId,
      waybill: result.waybill,
      status: 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storeOrderMapping(mapping);

    console.log(`Successfully synced order ${shopifyOrder.id} to Scan2Ship. Order ID: ${result.orderId}`);

  } catch (error) {
    console.error(`Failed to sync order ${shopifyOrder.id} to Scan2Ship:`, error);
    
    // Add to dead letter queue for manual retry
    await addToDeadLetterQueue(shop, shopifyOrder.id, error as Error);
    
    throw error;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  switch (topic) {
    case "ORDERS_CREATE":
      if (payload) {
        const order = payload as ShopifyOrder;
        console.log(`New order ${order.id} from ${shop}:`, {
          orderNumber: order.order_number,
          totalPrice: order.total_price,
          currency: order.currency,
          customerEmail: order.customer?.email,
          lineItems: order.line_items?.map((item: any) => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
          })),
        });

        try {
          // Sync order to Scan2Ship
          await syncOrderToScan2Ship(order, shop);
        } catch (error) {
          console.error(`Order sync failed for order ${order.id}:`, error);
          // Don't throw the error to avoid webhook retry loops
          // The order is already in the dead letter queue for manual retry
        }
      }
      break;
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
