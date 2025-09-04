# Order Sync to Scan2Ship Documentation

## Overview

The order sync functionality automatically pushes new Shopify orders to Scan2Ship when the `ORDERS_CREATE` webhook is triggered. This enables automatic label and waybill generation for shipping.

## Features

### ✅ **Security & Validation**
- **HMAC Verification**: Validates webhook requests using Shopify's built-in authentication
- **Data Validation**: Ensures all required order data is present before processing

### ✅ **Order Mapping**
- **Complete Field Mapping**: Maps all Shopify order fields to Scan2Ship format
- **Address Handling**: Uses shipping address with billing address fallback
- **COD Detection**: Automatically determines Cash on Delivery requirements
- **Line Item Processing**: Filters and maps only shippable items

### ✅ **Scan2Ship Integration**
- **Credits Check**: Verifies sufficient balance before order creation
- **Order Creation**: Creates orders via Scan2Ship API
- **Response Handling**: Captures order ID and waybill information

### ✅ **Error Handling & Reliability**
- **Retry Logic**: Exponential backoff for failed API calls
- **Dead Letter Queue**: Failed orders stored for manual retry
- **Graceful Degradation**: Webhook doesn't fail if order sync fails

### ✅ **Data Management**
- **Order Mapping**: Stores local mapping of Shopify ↔ Scan2Ship order IDs
- **Status Tracking**: Tracks order sync status (pending, created, failed)
- **Audit Trail**: Comprehensive logging for debugging

## Order Mapping

### Shopify Order → Scan2Ship Order

| Shopify Field | Scan2Ship Field | Notes |
|---------------|-----------------|-------|
| `shipping_address.first_name + last_name` | `name` | Full customer name |
| `customer.phone + address.phone` | `phones[]` | Array of phone numbers |
| `shipping_address` | `address` | Street, city, state, country, postal code |
| `financial_status` | `cod` | `true` if pending/partially_paid |
| `line_items` | `lineItems[]` | Only items requiring shipping |
| `total_price` | `declaredValue` | Order total value |
| `currency` | `currency` | Currency code |
| `order_number` | `reference` | Prefixed with "SHOPIFY-" |
| Order metadata | `metadata` | Shopify order ID, number, shop |

### Example Mapping

**Shopify Order:**
```json
{
  "id": 1234567890,
  "order_number": 1001,
  "total_price": "29.99",
  "currency": "USD",
  "financial_status": "paid",
  "customer": {
    "phone": "+1234567890"
  },
  "shipping_address": {
    "first_name": "John",
    "last_name": "Doe",
    "address1": "123 Main St",
    "city": "New York",
    "province": "NY",
    "country": "US",
    "zip": "10001"
  },
  "line_items": [
    {
      "title": "Product Name",
      "quantity": 1,
      "price": "29.99",
      "weight": 500,
      "requires_shipping": true
    }
  ]
}
```

**Scan2Ship Order:**
```json
{
  "name": "John Doe",
  "phones": ["+1234567890"],
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "country": "US",
    "postalCode": "10001"
  },
  "cod": false,
  "lineItems": [
    {
      "name": "Product Name",
      "quantity": 1,
      "weight": 500,
      "value": 29.99
    }
  ],
  "declaredValue": 29.99,
  "currency": "USD",
  "reference": "SHOPIFY-1001",
  "metadata": {
    "shopifyOrderId": 1234567890,
    "shopifyOrderNumber": 1001,
    "shop": "example-shop.myshopify.com"
  }
}
```

## API Integration

### Scan2Ship API Endpoints Used

1. **GET /api/credits**
   - Checks available credits balance
   - Ensures sufficient balance before order creation

2. **POST /api/orders**
   - Creates new order in Scan2Ship
   - Returns order ID and waybill information

### Request Flow

1. **Webhook Received** → Shopify sends `ORDERS_CREATE` webhook
2. **HMAC Validation** → Verify webhook authenticity
3. **Credits Check** → Ensure sufficient Scan2Ship credits
4. **Order Mapping** → Transform Shopify order to Scan2Ship format
5. **Order Creation** → Create order in Scan2Ship with retry logic
6. **Mapping Storage** → Store local order ID mapping
7. **Success Logging** → Log successful sync

## Error Handling

### Retry Logic
- **Max Retries**: 3 attempts
- **Backoff Strategy**: Exponential (1s, 2s, 4s)
- **Retryable Errors**: Network timeouts, temporary API failures

### Dead Letter Queue
Failed orders are stored in a dead letter queue for manual retry:
```json
{
  "shop": "example-shop.myshopify.com",
  "shopifyOrderId": 1234567890,
  "error": "Insufficient credits. Balance: 0, Required: 1",
  "timestamp": "2024-01-15T10:30:00Z",
  "retryCount": 0
}
```

### Error Scenarios

1. **Insufficient Credits**
   - **Error**: `Insufficient credits. Balance: 0, Required: 1`
   - **Action**: Add to dead letter queue
   - **Resolution**: Top up Scan2Ship credits

2. **Missing Address**
   - **Error**: `No shipping or billing address found`
   - **Action**: Add to dead letter queue
   - **Resolution**: Manual order processing

3. **API Timeout**
   - **Error**: Network timeout
   - **Action**: Retry with exponential backoff
   - **Resolution**: Automatic retry or dead letter queue

4. **Invalid Order Data**
   - **Error**: Scan2Ship API validation error
   - **Action**: Add to dead letter queue
   - **Resolution**: Fix order data and retry

## Local Data Storage

### Order Mapping Table
```typescript
interface OrderMapping {
  shop: string;                    // Shopify shop domain
  shopifyOrderId: number;          // Shopify order ID
  scan2shipOrderId: string;        // Scan2Ship order ID
  waybill?: string;                // Waybill number (if available)
  status: 'pending' | 'created' | 'failed';
  createdAt: string;               // ISO timestamp
  updatedAt: string;               // ISO timestamp
}
```

### Dead Letter Queue Table
```typescript
interface DeadLetterEntry {
  shop: string;                    // Shopify shop domain
  shopifyOrderId: number;          // Shopify order ID
  error: string;                   // Error message
  timestamp: string;               // ISO timestamp
  retryCount: number;              // Number of retry attempts
}
```

## Testing

### 1. Test Order Creation
Create a test order in your Shopify development store:
1. Add products to cart
2. Proceed to checkout
3. Complete the order
4. Check webhook logs for order sync

### 2. Test with cURL
```bash
curl -X POST \
  https://your-app-domain.com/webhooks/orders/create \
  -H 'Content-Type: application/json' \
  -H 'X-Shopify-Topic: orders/create' \
  -H 'X-Shopify-Shop-Domain: your-shop.myshopify.com' \
  -H 'X-Shopify-Hmac-Sha256: YOUR_HMAC_SIGNATURE' \
  -d '{
    "id": 1234567890,
    "order_number": 1001,
    "total_price": "29.99",
    "currency": "USD",
    "financial_status": "paid",
    "customer": {
      "phone": "+1234567890"
    },
    "shipping_address": {
      "first_name": "John",
      "last_name": "Doe",
      "address1": "123 Main St",
      "city": "New York",
      "province": "NY",
      "country": "US",
      "zip": "10001"
    },
    "line_items": [
      {
        "title": "Test Product",
        "quantity": 1,
        "price": "29.99",
        "weight": 500,
        "requires_shipping": true
      }
    ]
  }'
```

### 3. Verify in Scan2Ship
1. Check Scan2Ship dashboard for new orders
2. Verify order details match Shopify order
3. Confirm order status and waybill generation

## Monitoring & Logging

### Success Logs
```
Syncing order 1234567890 from example-shop.myshopify.com to Scan2Ship
Successfully synced order 1234567890 to Scan2Ship. Order ID: SCAN2SHIP-001
Order mapping stored: { shop: "example-shop.myshopify.com", shopifyOrderId: 1234567890, ... }
```

### Error Logs
```
Failed to sync order 1234567890 to Scan2Ship: Insufficient credits. Balance: 0, Required: 1
Adding to dead letter queue: { shop: "example-shop.myshopify.com", shopifyOrderId: 1234567890, ... }
```

### Metrics to Monitor
- Order sync success rate
- Average sync time
- Dead letter queue size
- Credits balance
- API error rates

## Configuration

### Environment Variables
```bash
# Scan2Ship API Configuration
SCAN2SHIP_API_URL=https://api.scan2ship.com
SCAN2SHIP_API_KEY=your_scan2ship_api_key_here

# Shopify App Configuration (already configured)
SHOPIFY_API_SECRET=your_shopify_api_secret_here
```

### Webhook Configuration
The webhook is automatically registered in `shopify.app.toml`:
```toml
[[webhooks.subscriptions]]
topics = [ "orders/create" ]
uri = "/webhooks/orders/create"
```

## Troubleshooting

### Common Issues

1. **Orders not syncing**
   - Check webhook registration in Partner Dashboard
   - Verify `SCAN2SHIP_API_KEY` is correct
   - Check credits balance in Scan2Ship

2. **HMAC verification failing**
   - Verify `SHOPIFY_API_SECRET` is correct
   - Check webhook URL is accessible
   - Ensure proper headers are sent

3. **Orders in dead letter queue**
   - Check Scan2Ship API status
   - Verify order data format
   - Review error messages for specific issues

4. **Missing order data**
   - Ensure orders have shipping addresses
   - Check line items have required fields
   - Verify customer information is complete

### Debug Mode
Enable detailed logging by setting:
```bash
NODE_ENV=development
```

This will provide comprehensive logs for troubleshooting order sync issues.

## Production Considerations

### Database Implementation
Replace console logging with proper database storage:
- Use Prisma or similar ORM
- Implement proper indexing
- Add data retention policies

### Monitoring
- Set up alerts for failed order syncs
- Monitor dead letter queue size
- Track API response times

### Scaling
- Consider queue-based processing for high volume
- Implement batch processing for efficiency
- Add rate limiting for API calls

### Security
- Rotate API keys regularly
- Implement proper access controls
- Monitor for suspicious activity
