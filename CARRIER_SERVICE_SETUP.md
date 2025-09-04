# Carrier Service Setup Guide

This document provides examples and snippets for testing the Scan2Ship carrier service integration.

## GraphQL Carrier Service Creation

### GraphiQL Query

```graphql
mutation carrierServiceCreate($name: String!, $callbackUrl: String!) {
  carrierServiceCreate(carrierService: {
    name: $name
    callbackUrl: $callbackUrl
    serviceDiscovery: true
  }) {
    carrierService {
      id
      name
      callbackUrl
      serviceDiscovery
      active
    }
    userErrors {
      field
      message
    }
  }
}
```

### Variables

```json
{
  "name": "Scan2Ship",
  "callbackUrl": "https://your-app-domain.com/carrier/rates"
}
```

### cURL Example

```bash
curl -X POST \
  https://your-shop.myshopify.com/admin/api/2025-07/graphql.json \
  -H 'Content-Type: application/json' \
  -H 'X-Shopify-Access-Token: YOUR_ACCESS_TOKEN' \
  -d '{
    "query": "mutation carrierServiceCreate($name: String!, $callbackUrl: String!) { carrierServiceCreate(carrierService: { name: $name, callbackUrl: $callbackUrl, serviceDiscovery: true }) { carrierService { id name callbackUrl serviceDiscovery active } userErrors { field message } } }",
    "variables": {
      "name": "Scan2Ship",
      "callbackUrl": "https://your-app-domain.com/carrier/rates"
    }
  }'
```

## Testing Carrier Rates Endpoint

### Sample Request to Carrier Rates Endpoint

```bash
curl -X POST \
  https://your-app-domain.com/carrier/rates \
  -H 'Content-Type: application/json' \
  -d '{
    "rate": {
      "origin": {
        "country": "US",
        "province": "CA",
        "city": "San Francisco",
        "zip": "94102"
      },
      "destination": {
        "country": "US",
        "province": "NY",
        "city": "New York",
        "zip": "10001"
      },
      "items": [
        {
          "name": "Test Product",
          "sku": "TEST-001",
          "quantity": 1,
          "grams": 500,
          "price": 29.99,
          "vendor": "Test Vendor",
          "requires_shipping": true,
          "taxable": true,
          "fulfillment_service": "manual"
        }
      ],
      "currency": "USD"
    }
  }'
```

### Expected Response

```json
{
  "rates": [
    {
      "service_name": "Scan2Ship Standard",
      "service_code": "SCAN2SHIP_STANDARD",
      "total_price": "12.99",
      "currency": "USD",
      "min_delivery_date": "2024-01-15",
      "max_delivery_date": "2024-01-17",
      "description": "Standard shipping via Scan2Ship network"
    },
    {
      "service_name": "Scan2Ship Express",
      "service_code": "SCAN2SHIP_EXPRESS",
      "total_price": "24.99",
      "currency": "USD",
      "min_delivery_date": "2024-01-14",
      "max_delivery_date": "2024-01-15",
      "description": "Express shipping via Scan2Ship network"
    }
  ]
}
```

## Webhook Testing

### Test Orders Create Webhook

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
    "customer": {
      "email": "customer@example.com"
    },
    "line_items": [
      {
        "id": 9876543210,
        "title": "Test Product",
        "quantity": 1,
        "price": "29.99"
      }
    ]
  }'
```

### Test Fulfillments Update Webhook

```bash
curl -X POST \
  https://your-app-domain.com/webhooks/fulfillments/update \
  -H 'Content-Type: application/json' \
  -H 'X-Shopify-Topic: fulfillments/update' \
  -H 'X-Shopify-Shop-Domain: your-shop.myshopify.com' \
  -H 'X-Shopify-Hmac-Sha256: YOUR_HMAC_SIGNATURE' \
  -d '{
    "id": 1111111111,
    "order_id": 1234567890,
    "status": "success",
    "tracking_company": "Scan2Ship",
    "tracking_number": "SCAN123456789",
    "tracking_url": "https://tracking.scan2ship.com/SCAN123456789",
    "line_items": [
      {
        "id": 9876543210,
        "quantity": 1
      }
    ]
  }'
```

## Verification Steps

1. **Check Carrier Service Registration**:
   - After app installation, verify the carrier service is created
   - Check that `active: true` in the GraphQL response
   - Confirm the callback URL is correct

2. **Test Rate Calculation**:
   - Create a test order in your development store
   - Verify Scan2Ship rates appear at checkout
   - Check that rates are calculated correctly

3. **Verify Webhook Registration**:
   - Check webhook subscriptions in Partner Dashboard
   - Confirm webhooks are registered for `orders/create` and `fulfillments/update`
   - Test webhook delivery using Shopify CLI: `shopify app generate webhook`

4. **Test Order Sync**:
   - Create a test order
   - Verify the order is received via webhook
   - Check that order data is properly logged/processed

## Troubleshooting

### Carrier Service Not Appearing
- Verify `write_shipping` scope is granted
- Check that the callback URL is accessible
- Ensure the afterAuth hook is executing successfully

### Webhooks Not Firing
- Verify webhook subscriptions in Partner Dashboard
- Check that webhook URLs are accessible
- Ensure proper HMAC validation in webhook handlers

### Rate Calculation Issues
- Verify the carrier rates endpoint returns valid JSON
- Check that service codes match what's expected
- Ensure currency and pricing format is correct
