// Utility functions for creating fulfillments in Shopify
// This can be called from within the app when we have access to the admin client

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

// Types for fulfillment operations
export interface FulfillmentData {
  orderRef: string;           // Reference like "SHOPIFY-1001"
  trackingNumber: string;     // Tracking number from carrier
  carrier: string;            // Carrier name (e.g., "FedEx", "UPS", "DHL")
  url?: string;              // Tracking URL (optional)
  status?: string;           // Order status (optional)
  waybill?: string;          // Waybill number (optional)
}

export interface ShopifyFulfillmentOrder {
  id: string;
  orderId: string;
  status: string;
  lineItems: Array<{
    id: string;
    sku?: string;
    quantity: number;
    remainingQuantity: number;
  }>;
}

export interface ShopifyFulfillmentInput {
  fulfillmentOrderId: string;
  tracking?: {
    company: string;
    number: string;
    url?: string;
  };
  notifyCustomer?: boolean;
  lineItems?: Array<{
    id: string;
    quantity: number;
  }>;
}

// Extract Shopify order ID from Scan2Ship order reference
export function extractShopifyOrderId(orderRef: string): number | null {
  // Expected format: "SHOPIFY-1001" or "SHOPIFY-1234567890"
  const match = orderRef.match(/^SHOPIFY-(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// Fetch fulfillment orders for a Shopify order
export async function fetchFulfillmentOrders(admin: AdminApiContext, orderId: string): Promise<ShopifyFulfillmentOrder[]> {
  const query = `
    query getFulfillmentOrders($orderId: ID!) {
      order(id: $orderId) {
        id
        fulfillmentOrders(first: 10) {
          edges {
            node {
              id
              status
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    sku
                    quantity
                    remainingQuantity
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, {
      variables: { orderId: `gid://shopify/Order/${orderId}` }
    });

    const responseJson = await response.json();
    
    if (responseJson.data?.order?.fulfillmentOrders?.edges) {
      return responseJson.data.order.fulfillmentOrders.edges.map((edge: any) => ({
        id: edge.node.id,
        orderId: responseJson.data.order.id,
        status: edge.node.status,
        lineItems: edge.node.lineItems.edges.map((itemEdge: any) => ({
          id: itemEdge.node.id,
          sku: itemEdge.node.sku,
          quantity: itemEdge.node.quantity,
          remainingQuantity: itemEdge.node.remainingQuantity,
        })),
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching fulfillment orders:', error);
    throw error;
  }
}

// Create fulfillment in Shopify
export async function createFulfillment(admin: AdminApiContext, fulfillmentInput: ShopifyFulfillmentInput): Promise<{ fulfillmentId: string; trackingInfo?: any }> {
  const mutation = `
    mutation fulfillmentCreate($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment {
          id
          status
          trackingInfo {
            company
            number
            url
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(mutation, {
      variables: {
        fulfillment: {
          fulfillmentOrderId: fulfillmentInput.fulfillmentOrderId,
          tracking: fulfillmentInput.tracking,
          notifyCustomer: fulfillmentInput.notifyCustomer || true,
          lineItems: fulfillmentInput.lineItems,
        }
      }
    });

    const responseJson = await response.json();
    
    if (responseJson.data?.fulfillmentCreate?.userErrors?.length > 0) {
      const errors = responseJson.data.fulfillmentCreate.userErrors;
      throw new Error(`Fulfillment creation failed: ${errors.map((e: any) => e.message).join(', ')}`);
    }

    const fulfillment = responseJson.data?.fulfillmentCreate?.fulfillment;
    if (!fulfillment) {
      throw new Error('No fulfillment returned from GraphQL mutation');
    }

    return {
      fulfillmentId: fulfillment.id,
      trackingInfo: fulfillment.trackingInfo,
    };
  } catch (error) {
    console.error('Error creating fulfillment:', error);
    throw error;
  }
}

// Main fulfillment processing function
export async function processFulfillment(admin: AdminApiContext, fulfillmentData: FulfillmentData): Promise<{ fulfillmentId: string; trackingInfo?: any }> {
  try {
    console.log(`Processing fulfillment for order ${fulfillmentData.orderRef}`);

    // Extract Shopify order ID from order reference
    const shopifyOrderId = extractShopifyOrderId(fulfillmentData.orderRef);
    if (!shopifyOrderId) {
      throw new Error(`Invalid order reference format: ${fulfillmentData.orderRef}`);
    }

    // Fetch fulfillment orders for the Shopify order
    const fulfillmentOrders = await fetchFulfillmentOrders(admin, shopifyOrderId.toString());
    
    if (fulfillmentOrders.length === 0) {
      throw new Error(`No fulfillment orders found for order ${shopifyOrderId}`);
    }

    // Find the first open fulfillment order
    const openFulfillmentOrder = fulfillmentOrders.find(fo => fo.status === 'OPEN');
    if (!openFulfillmentOrder) {
      throw new Error(`No open fulfillment orders found for order ${shopifyOrderId}`);
    }

    // Prepare fulfillment input
    const fulfillmentInput: ShopifyFulfillmentInput = {
      fulfillmentOrderId: openFulfillmentOrder.id,
      tracking: {
        company: fulfillmentData.carrier,
        number: fulfillmentData.trackingNumber,
        url: fulfillmentData.url,
      },
      notifyCustomer: true,
      // Fulfill all remaining line items
      lineItems: openFulfillmentOrder.lineItems
        .filter(item => item.remainingQuantity > 0)
        .map(item => ({
          id: item.id,
          quantity: item.remainingQuantity,
        })),
    };

    // Create fulfillment
    const result = await createFulfillment(admin, fulfillmentInput);
    
    console.log(`Successfully created fulfillment ${result.fulfillmentId} for order ${shopifyOrderId}`);
    
    return result;

  } catch (error) {
    console.error(`Failed to process fulfillment for order ${fulfillmentData.orderRef}:`, error);
    throw error;
  }
}

// Update local order mapping with fulfillment information
export async function updateOrderMappingWithFulfillment(
  shop: string, 
  shopifyOrderId: number, 
  fulfillmentId: string, 
  trackingInfo: any
): Promise<void> {
  try {
    const mappingUpdate = {
      shop,
      shopifyOrderId,
      fulfillmentId,
      trackingInfo,
      status: 'fulfilled',
      updatedAt: new Date().toISOString(),
    };
    
    console.log('Updating order mapping with fulfillment:', mappingUpdate);
    
    // TODO: Implement database update
    // await db.orderMappings.update({
    //   where: { shop_shopifyOrderId: { shop, shopifyOrderId } },
    //   data: mappingUpdate
    // });
  } catch (error) {
    console.error('Error updating order mapping:', error);
    throw error;
  }
}
