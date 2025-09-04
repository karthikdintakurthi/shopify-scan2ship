import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  switch (topic) {
    case "FULFILLMENTS_UPDATE":
      if (payload) {
        console.log("Fulfillment updated:", payload);
        
        // TODO: Update fulfillment status in Scan2Ship
        // Example: await updateFulfillmentInScan2Ship(payload);
        
        // Example of accessing fulfillment data:
        const fulfillment = payload as any;
        console.log(`Fulfillment ${fulfillment.id} updated for order ${fulfillment.order_id}:`, {
          status: fulfillment.status,
          trackingCompany: fulfillment.tracking_company,
          trackingNumber: fulfillment.tracking_number,
          trackingUrl: fulfillment.tracking_url,
          lineItems: fulfillment.line_items?.map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
          })),
        });
      }
      break;
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
