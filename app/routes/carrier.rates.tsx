import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

// Carrier Service endpoint for live shipping rates
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    console.log("Carrier rates request:", body);

    // Extract shipping information from Shopify's request
    const { 
      rate: {
        origin: {
          country: originCountry,
        },
        destination: {
          country: destCountry,
        },
        items,
        currency,
      }
    } = body;

    // TODO: Integrate with actual carrier APIs (UPS, FedEx, DHL, etc.)
    // For now, return mock rates
    const mockRates = [
      {
        service_name: "Scan2Ship Standard",
        service_code: "SCAN2SHIP_STANDARD",
        total_price: "12.99",
        currency: currency || "USD",
        min_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        max_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: "Standard shipping via Scan2Ship network",
      },
      {
        service_name: "Scan2Ship Express",
        service_code: "SCAN2SHIP_EXPRESS",
        total_price: "24.99",
        currency: currency || "USD",
        min_delivery_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        max_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: "Express shipping via Scan2Ship network",
      },
      {
        service_name: "Scan2Ship Overnight",
        service_code: "SCAN2SHIP_OVERNIGHT",
        total_price: "39.99",
        currency: currency || "USD",
        min_delivery_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        max_delivery_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: "Overnight delivery via Scan2Ship network",
      },
    ];

    // Filter rates based on destination (example logic)
    const availableRates = mockRates.filter(rate => {
      // Add your business logic here
      // For example, exclude overnight for international orders
      if (destCountry !== originCountry && rate.service_code === "SCAN2SHIP_OVERNIGHT") {
        return false;
      }
      return true;
    });

    console.log(`Returning ${availableRates.length} rates for ${items.length} items`);

    return json({ rates: availableRates });
  } catch (error) {
    console.error("Error processing carrier rates request:", error);
    return json({ error: "Internal server error" }, { status: 500 });
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
