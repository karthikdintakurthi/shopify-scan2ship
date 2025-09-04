import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";

// Types for Scan2Ship webhook payload
interface Scan2ShipWebhookPayload {
  orderRef: string;           // Reference like "SHOPIFY-1001"
  trackingNumber: string;     // Tracking number from carrier
  carrier: string;            // Carrier name (e.g., "FedEx", "UPS", "DHL")
  url?: string;              // Tracking URL (optional)
  status?: string;           // Order status (optional)
  waybill?: string;          // Waybill number (optional)
  timestamp?: string;        // Timestamp (optional)
}

// Note: Shopify fulfillment types are defined in app/utils/fulfillment.server.ts

// HMAC verification for Scan2Ship webhook requests
function verifyScan2ShipHMAC(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body, 'utf8');
  const calculatedSignature = hmac.digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'base64'),
    Buffer.from(calculatedSignature, 'base64')
  );
}

// Note: Fulfillment processing functions are implemented in app/utils/fulfillment.server.ts

// Note: Main fulfillment processing is implemented in app/utils/fulfillment.server.ts
// This webhook endpoint receives the data and logs it for now

// Scan2Ship webhook endpoint for order ready notifications
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.text();
    const signature = request.headers.get('X-Scan2Ship-Signature');
    const shop = request.headers.get('X-Shopify-Shop-Domain');

    if (!shop) {
      return json({ error: "Missing shop domain" }, { status: 400 });
    }

    // Verify HMAC signature (if Scan2Ship provides one)
    if (signature && process.env.SCAN2SHIP_WEBHOOK_SECRET) {
      if (!verifyScan2ShipHMAC(body, signature, process.env.SCAN2SHIP_WEBHOOK_SECRET)) {
        console.error('Invalid Scan2Ship webhook signature');
        return json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Parse payload
    const payload: Scan2ShipWebhookPayload = JSON.parse(body);
    console.log('Scan2Ship webhook payload:', payload);

    // Validate required fields
    if (!payload.orderRef || !payload.trackingNumber || !payload.carrier) {
      return json({ 
        error: "Missing required fields: orderRef, trackingNumber, carrier" 
      }, { status: 400 });
    }

    // For now, we'll log the fulfillment data and return success
    // In a production implementation, you would:
    // 1. Look up the Shopify order by orderRef
    // 2. Get the admin client for that shop
    // 3. Create the fulfillment via GraphQL
    console.log('Fulfillment data received:', {
      orderRef: payload.orderRef,
      trackingNumber: payload.trackingNumber,
      carrier: payload.carrier,
      url: payload.url,
      shop: shop
    });

    // TODO: Implement actual fulfillment creation
    // await processFulfillment(payload, shop);

    return json({ 
      success: true, 
      message: `Fulfillment data received for order ${payload.orderRef}`,
      note: "Fulfillment creation not yet implemented - requires session management"
    });

  } catch (error) {
    console.error("Error processing Scan2Ship webhook:", error);
    return json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

// Handle GET requests for webhook verification (if needed)
export const loader = async () => {
  return json({ 
    message: "Scan2Ship webhook endpoint is active",
    timestamp: new Date().toISOString()
  });
};
