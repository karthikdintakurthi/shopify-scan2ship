import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  switch (topic) {
    case "ORDERS_CREATE":
      if (payload) {
        console.log("Order created:", payload);
        
        // TODO: Sync order to Scan2Ship
        // Example: await syncOrderToScan2Ship(payload);
        
        // Example of accessing order data:
        const order = payload as any;
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
      }
      break;
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
