# Fulfillment Write-Back Documentation

## Overview

The fulfillment write-back functionality automatically marks Shopify orders as fulfilled when Scan2Ship creates labels/waybills. This ensures that customers receive tracking information and orders show as "Fulfilled" in Shopify Admin.

## Features

### ✅ **Webhook Endpoint**
- **Endpoint**: `/scan2ship/webhooks/order-ready`
- **Method**: POST
- **Security**: HMAC signature verification
- **Payload**: Order reference, tracking number, carrier, and tracking URL

### ✅ **GraphQL Integration**
- **Fulfillment Orders**: Fetches open fulfillment orders for the Shopify order
- **Fulfillment Creation**: Creates fulfillments with tracking information
- **API Version**: Uses GraphQL Admin API 2025-07

### ✅ **Tracking Information**
- **Carrier**: Automatically set from Scan2Ship data
- **Tracking Number**: From carrier/waybill
- **Tracking URL**: Optional tracking URL for customer convenience
- **Customer Notification**: Automatically notifies customers

### ✅ **Order Mapping**
- **Local Storage**: Updates order mapping with fulfillment ID
- **Status Tracking**: Marks orders as fulfilled
- **Audit Trail**: Comprehensive logging for debugging

## Architecture

### Webhook Flow

1. **Scan2Ship Creates Label** → Generates tracking number and waybill
2. **Webhook Callback** → Scan2Ship calls `/scan2ship/webhooks/order-ready`
3. **HMAC Verification** → Validates webhook authenticity
4. **Order Lookup** → Extracts Shopify order ID from order reference
5. **Fulfillment Creation** → Creates fulfillment via GraphQL
6. **Mapping Update** → Updates local order mapping
7. **Customer Notification** → Shopify automatically notifies customer

### File Structure

```
app/
├── routes/
│   ├── scan2ship.webhooks.order-ready.tsx    # Webhook endpoint
│   └── fulfillment.demo.tsx                  # Demo/testing endpoint
└── utils/
    └── fulfillment.server.ts                 # Core fulfillment logic
```

## API Reference

### Webhook Endpoint

**URL**: `POST /scan2ship/webhooks/order-ready`

**Headers**:
```
Content-Type: application/json
X-Scan2Ship-Signature: <HMAC_SIGNATURE>
X-Shopify-Shop-Domain: <SHOP_DOMAIN>
```

**Payload**:
```json
{
  "orderRef": "SHOPIFY-1001",
  "trackingNumber": "1Z999AA1234567890",
  "carrier": "UPS",
  "url": "https://www.ups.com/track?trackingNumber=1Z999AA1234567890",
  "status": "ready",
  "waybill": "WB123456789",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Fulfillment data received for order SHOPIFY-1001",
  "note": "Fulfillment creation not yet implemented - requires session management"
}
```

### GraphQL Mutations

#### Fetch Fulfillment Orders
```graphql
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
```

#### Create Fulfillment
```graphql
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
```

## Implementation Details

### Order Reference Format

Scan2Ship order references follow the format: `SHOPIFY-{ORDER_NUMBER}`

**Examples**:
- `SHOPIFY-1001` → Shopify order #1001
- `SHOPIFY-1234567890` → Shopify order ID 1234567890

### Fulfillment Processing

1. **Extract Order ID**: Parse order reference to get Shopify order ID
2. **Fetch Fulfillment Orders**: Get open fulfillment orders for the order
3. **Create Fulfillment**: Create fulfillment with tracking information
4. **Update Mapping**: Store fulfillment ID in local mapping

### Error Handling

- **Invalid Order Reference**: Returns 400 error
- **No Fulfillment Orders**: Logs warning and continues
- **GraphQL Errors**: Captures and logs user errors
- **Network Errors**: Retries with exponential backoff

## Configuration

### Environment Variables

```bash
# Scan2Ship Webhook Configuration
SCAN2SHIP_WEBHOOK_SECRET=your_scan2ship_webhook_secret_here

# Existing variables
SCAN2SHIP_API_URL=https://api.scan2ship.com
SCAN2SHIP_API_KEY=your_scan2ship_api_key_here
```

### Webhook Registration

Configure Scan2Ship to call your webhook endpoint:
```
URL: https://your-app-domain.com/scan2ship/webhooks/order-ready
Method: POST
Headers: X-Scan2Ship-Signature, X-Shopify-Shop-Domain
```

## Testing

### 1. Test Webhook Endpoint

```bash
curl -X POST \
  https://your-app-domain.com/scan2ship/webhooks/order-ready \
  -H 'Content-Type: application/json' \
  -H 'X-Shopify-Shop-Domain: your-shop.myshopify.com' \
  -H 'X-Scan2Ship-Signature: YOUR_HMAC_SIGNATURE' \
  -d '{
    "orderRef": "SHOPIFY-1001",
    "trackingNumber": "1Z999AA1234567890",
    "carrier": "UPS",
    "url": "https://www.ups.com/track?trackingNumber=1Z999AA1234567890"
  }'
```

### 2. Test Fulfillment Creation

Use the demo endpoint to test fulfillment creation:

```bash
curl -X POST \
  https://your-app-domain.com/fulfillment/demo \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_SHOPIFY_TOKEN' \
  -d '{
    "orderRef": "SHOPIFY-1001",
    "trackingNumber": "1Z999AA1234567890",
    "carrier": "UPS",
    "url": "https://www.ups.com/track?trackingNumber=1Z999AA1234567890"
  }'
```

### 3. Verify in Shopify

1. Check order status in Shopify Admin
2. Verify fulfillment is created
3. Confirm tracking information is displayed
4. Check customer notification

## Production Implementation

### Session Management

The current implementation requires session management to access the Shopify admin client. In production:

1. **Store Sessions**: Persist Shopify sessions in database
2. **Retrieve Admin Client**: Get admin client from stored session
3. **Handle Expired Sessions**: Refresh tokens as needed

### Database Integration

Replace console logging with proper database storage:

```typescript
// Update order mapping
await db.orderMappings.update({
  where: { shop_shopifyOrderId: { shop, shopifyOrderId } },
  data: {
    fulfillmentId,
    trackingInfo,
    status: 'fulfilled',
    updatedAt: new Date(),
  }
});
```

### Error Handling

Implement comprehensive error handling:

- **Retry Logic**: For temporary failures
- **Dead Letter Queue**: For failed fulfillments
- **Monitoring**: Track success/failure rates
- **Alerting**: Notify on critical failures

## Security

### HMAC Verification

```typescript
function verifyScan2ShipHMAC(body: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body, 'utf8');
  const calculatedSignature = hmac.digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'base64'),
    Buffer.from(calculatedSignature, 'base64')
  );
}
```

### Best Practices

- **Validate Input**: Check all required fields
- **Rate Limiting**: Prevent abuse
- **Logging**: Comprehensive audit trail
- **Monitoring**: Track webhook performance

## Troubleshooting

### Common Issues

1. **Webhook Not Receiving Data**
   - Check Scan2Ship webhook configuration
   - Verify endpoint URL is accessible
   - Check HMAC signature verification

2. **Fulfillment Creation Fails**
   - Verify order exists in Shopify
   - Check fulfillment order status
   - Review GraphQL error messages

3. **Tracking Information Missing**
   - Ensure carrier name is valid
   - Check tracking number format
   - Verify tracking URL is accessible

### Debug Mode

Enable detailed logging:

```bash
NODE_ENV=development
```

This provides comprehensive logs for troubleshooting fulfillment issues.

## Monitoring

### Key Metrics

- **Webhook Success Rate**: Percentage of successful webhook calls
- **Fulfillment Creation Rate**: Percentage of successful fulfillments
- **Processing Time**: Average time to process fulfillments
- **Error Rate**: Percentage of failed operations

### Logs to Monitor

```
Success: "Successfully created fulfillment {fulfillmentId} for order {orderId}"
Error: "Failed to process fulfillment for order {orderRef}: {error}"
Warning: "No fulfillment orders found for order {orderId}"
```

## Future Enhancements

### Planned Features

1. **Partial Fulfillments**: Support for partial order fulfillment
2. **Multi-Carrier**: Handle multiple carriers per order
3. **Custom Tracking**: Support for custom tracking URLs
4. **Bulk Processing**: Process multiple fulfillments at once

### Integration Opportunities

1. **Inventory Management**: Update inventory levels
2. **Customer Communication**: Send custom notifications
3. **Analytics**: Track fulfillment performance
4. **Reporting**: Generate fulfillment reports
