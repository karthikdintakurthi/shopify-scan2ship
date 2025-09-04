import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";

// Types for Shopify carrier service request
interface ShopifyRateRequest {
  rate: {
    origin: {
      country: string;
      province?: string;
      city?: string;
      zip?: string;
    };
    destination: {
      country: string;
      province?: string;
      city?: string;
      zip?: string;
    };
    items: Array<{
      name: string;
      sku?: string;
      quantity: number;
      grams: number;
      price: string;
      vendor?: string;
      requires_shipping: boolean;
      taxable: boolean;
      fulfillment_service?: string;
    }>;
    currency: string;
  };
}

interface Scan2ShipRate {
  service_name: string;
  service_code: string;
  total_price: string;
  currency: string;
  min_delivery_date: string;
  max_delivery_date: string;
  description?: string;
}

// HMAC verification for Shopify requests
function verifyShopifyHMAC(body: string, signature: string, secret: string): boolean {
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

// Call Scan2Ship API to get courier services
async function getScan2ShipCourierServices(): Promise<any[]> {
  try {
    const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/courier-services`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Scan2Ship API error: ${response.status}`);
    }

    const data = await response.json();
    return data.courierServices || [];
  } catch (error) {
    console.error('Error fetching Scan2Ship courier services:', error);
    return [];
  }
}

// Call Scan2Ship API to get order configuration
async function getScan2ShipOrderConfig(): Promise<any> {
  try {
    const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/order-config`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Scan2Ship API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Scan2Ship order config:', error);
    return null;
  }
}

// Get live rates from Scan2Ship
async function getScan2ShipRates(rateRequest: ShopifyRateRequest): Promise<Scan2ShipRate[]> {
  try {
    // Get available courier services
    const courierServices = await getScan2ShipCourierServices();
    if (courierServices.length === 0) {
      throw new Error('No courier services available');
    }

    // Get order configuration (for future use)
    await getScan2ShipOrderConfig();

    // Calculate total weight and value
    const totalWeight = rateRequest.rate.items.reduce((sum, item) => sum + (item.grams * item.quantity), 0);
    const totalValue = rateRequest.rate.items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

    // Prepare rate request for Scan2Ship
    const scan2ShipRequest = {
      origin: {
        country: rateRequest.rate.origin.country,
        province: rateRequest.rate.origin.province,
        city: rateRequest.rate.origin.city,
        postalCode: rateRequest.rate.origin.zip,
      },
      destination: {
        country: rateRequest.rate.destination.country,
        province: rateRequest.rate.destination.province,
        city: rateRequest.rate.destination.city,
        postalCode: rateRequest.rate.destination.zip,
      },
      package: {
        weight: totalWeight,
        value: totalValue,
        currency: rateRequest.rate.currency,
        items: rateRequest.rate.items.map(item => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          weight: item.grams,
          value: parseFloat(item.price),
        })),
      },
      courierServices: courierServices.map(service => service.id),
    };

    // Call Scan2Ship rates API
    const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/rates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scan2ShipRequest),
    });

    if (!response.ok) {
      throw new Error(`Scan2Ship rates API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform Scan2Ship rates to Shopify format
    return data.rates.map((rate: any) => ({
      service_name: rate.serviceName,
      service_code: rate.serviceCode,
      total_price: (rate.totalPrice / 100).toFixed(2), // Convert from minor units
      currency: rate.currency,
      min_delivery_date: rate.minDeliveryDate,
      max_delivery_date: rate.maxDeliveryDate,
      description: rate.description,
    }));

  } catch (error) {
    console.error('Error fetching Scan2Ship rates:', error);
    throw error;
  }
}

// Track analytics event
async function trackAnalytics(eventType: string, data: any) {
  try {
    await fetch(`${process.env.SCAN2SHIP_API_URL}/api/analytics/track`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType,
        timestamp: new Date().toISOString(),
        data,
      }),
    });
  } catch (error) {
    console.error('Error tracking analytics:', error);
    // Don't fail the request if analytics fails
  }
}

// Generate fallback rate when Scan2Ship is unavailable
function getFallbackRate(currency: string): Scan2ShipRate {
  return {
    service_name: "Standard Shipping",
    service_code: "STANDARD",
    total_price: "9.99",
    currency: currency || "USD",
    min_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    max_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: "Standard shipping service",
  };
}

// Carrier Service endpoint for live shipping rates
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Get request body and headers
    const body = await request.text();
    const signature = request.headers.get('X-Shopify-Hmac-Sha256');
    
    // Verify HMAC signature
    if (!verifyShopifyHMAC(body, signature || '', process.env.SHOPIFY_API_SECRET || '')) {
      console.error('Invalid HMAC signature');
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the request body
    const rateRequest: ShopifyRateRequest = JSON.parse(body);
    console.log("Carrier rates request:", rateRequest);

    // Track the rate request
    await trackAnalytics("rate_requested", {
      origin: rateRequest.rate.origin,
      destination: rateRequest.rate.destination,
      itemCount: rateRequest.rate.items.length,
      currency: rateRequest.rate.currency,
    });

    let rates: Scan2ShipRate[] = [];

    try {
      // Try to get rates from Scan2Ship
      rates = await getScan2ShipRates(rateRequest);
      
      if (rates.length === 0) {
        throw new Error('No rates returned from Scan2Ship');
      }

      console.log(`Returning ${rates.length} rates from Scan2Ship`);

    } catch (error) {
      console.error('Scan2Ship integration failed, using fallback:', error);
      
      // Use fallback rate when Scan2Ship is unavailable
      rates = [getFallbackRate(rateRequest.rate.currency)];
      
      // Track the fallback usage
      await trackAnalytics("fallback_rate_used", {
        error: error instanceof Error ? error.message : 'Unknown error',
        origin: rateRequest.rate.origin,
        destination: rateRequest.rate.destination,
      });
    }

    return json({ rates });

  } catch (error) {
    console.error("Error processing carrier rates request:", error);
    
    // Return fallback rate even if everything fails
    const fallbackRate = getFallbackRate("USD");
    return json({ rates: [fallbackRate] });
  }
};

// Handle GET requests for service discovery
export const loader = async () => {
  return json({
    service: {
      name: "Scan2Ship",
      service_discovery: true,
    },
  });
};
