import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { processFulfillment, updateOrderMappingWithFulfillment, type FulfillmentData } from "../utils/fulfillment.server";

// Test route for fulfillment functionality
// This demonstrates how to create fulfillments when you have access to the admin client

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  return json({
    message: "Fulfillment demo endpoint",
    instructions: "Use POST to test fulfillment creation",
    example: {
      orderRef: "SHOPIFY-1001",
      trackingNumber: "1Z999AA1234567890",
      carrier: "UPS",
      url: "https://www.ups.com/track?trackingNumber=1Z999AA1234567890"
    }
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.orderRef || !body.trackingNumber || !body.carrier) {
      return json({ 
        error: "Missing required fields: orderRef, trackingNumber, carrier" 
      }, { status: 400 });
    }

    const fulfillmentData: FulfillmentData = {
      orderRef: body.orderRef,
      trackingNumber: body.trackingNumber,
      carrier: body.carrier,
      url: body.url,
      status: body.status,
      waybill: body.waybill,
    };

    console.log('Testing fulfillment creation with data:', fulfillmentData);

    // Process fulfillment
    const result = await processFulfillment(admin, fulfillmentData);
    
    // Update local mapping
    const shopifyOrderId = parseInt(fulfillmentData.orderRef.replace('SHOPIFY-', ''), 10);
    await updateOrderMappingWithFulfillment(
      session.shop, 
      shopifyOrderId, 
      result.fulfillmentId, 
      result.trackingInfo
    );

    return json({
      success: true,
      message: `Fulfillment created successfully for order ${fulfillmentData.orderRef}`,
      fulfillmentId: result.fulfillmentId,
      trackingInfo: result.trackingInfo,
    });

  } catch (error) {
    console.error("Error testing fulfillment:", error);
    return json({ 
      error: "Fulfillment creation failed",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
