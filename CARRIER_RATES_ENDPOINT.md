# Carrier Rates Endpoint Documentation

## Overview

The carrier rates endpoint (`/carrier/rates`) provides live shipping rates from Scan2Ship to Shopify's checkout process. This endpoint is called by Shopify when customers are selecting shipping options during checkout.

## Features

### ✅ **Security**
- **HMAC Verification**: Validates incoming requests using Shopify's HMAC-SHA256 signature
- **Request Validation**: Ensures requests are properly formatted and authenticated

### ✅ **Scan2Ship Integration**
- **Courier Services**: Fetches active courier services from Scan2Ship API
- **Order Configuration**: Retrieves order configuration settings
- **Live Rates**: Gets real-time shipping rates from multiple carriers
- **Rate Transformation**: Converts Scan2Ship rates to Shopify format

### ✅ **Error Handling & Fallbacks**
- **Graceful Degradation**: Falls back to standard shipping if Scan2Ship is unavailable
- **Timeout Protection**: Handles API timeouts gracefully
- **Error Logging**: Comprehensive error logging for debugging

### ✅ **Analytics Tracking**
- **Rate Requests**: Tracks when rates are requested
- **Fallback Usage**: Monitors when fallback rates are used
- **Performance Metrics**: Logs response times and success rates

## API Endpoints Used

### Scan2Ship API Endpoints

1. **GET /api/courier-services**
   - Fetches active courier services
   - Returns list of available carriers

2. **GET /api/order-config**
   - Retrieves order configuration
   - Returns shipping preferences and settings

3. **POST /api/rates**
   - Calculates shipping rates
   - Returns rates from multiple carriers

4. **POST /api/analytics/track**
   - Tracks analytics events
   - Logs rate requests and fallback usage

## Request Format

### Shopify Request Structure
```json
{
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
        "name": "Product Name",
        "sku": "SKU-001",
        "quantity": 1,
        "grams": 500,
        "price": "29.99",
        "vendor": "Vendor Name",
        "requires_shipping": true,
        "taxable": true,
        "fulfillment_service": "manual"
      }
    ],
    "currency": "USD"
  }
}
```

### Headers Required
```
Content-Type: application/json
X-Shopify-Hmac-Sha256: <HMAC_SIGNATURE>
```

## Response Format

### Success Response
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

### Fallback Response (when Scan2Ship is unavailable)
```json
{
  "rates": [
    {
      "service_name": "Standard Shipping",
      "service_code": "STANDARD",
      "total_price": "9.99",
      "currency": "USD",
      "min_delivery_date": "2024-01-15",
      "max_delivery_date": "2024-01-19",
      "description": "Standard shipping service"
    }
  ]
}
```

## Environment Variables

Add these to your `.env` file:

```bash
# Scan2Ship API Configuration
SCAN2SHIP_API_URL=https://api.scan2ship.com
SCAN2SHIP_API_KEY=your_scan2ship_api_key_here

# Shopify App Configuration (already configured)
SHOPIFY_API_SECRET=your_shopify_api_secret_here
```

## Testing the Endpoint

### 1. Test with cURL
```bash
curl -X POST \
  https://your-app-domain.com/carrier/rates \
  -H 'Content-Type: application/json' \
  -H 'X-Shopify-Hmac-Sha256: YOUR_HMAC_SIGNATURE' \
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
          "price": "29.99",
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

### 2. Test in Shopify Checkout
1. Create a test order in your development store
2. Proceed to checkout
3. Verify that Scan2Ship rates appear in shipping options
4. Check browser network tab for requests to `/carrier/rates`

## Error Scenarios

### 1. Invalid HMAC Signature
- **Response**: `401 Unauthorized`
- **Cause**: Missing or invalid HMAC signature
- **Solution**: Ensure `SHOPIFY_API_SECRET` is correct

### 2. Scan2Ship API Unavailable
- **Response**: Fallback rate returned
- **Cause**: Network timeout or API error
- **Solution**: Check Scan2Ship API status and credentials

### 3. No Courier Services Available
- **Response**: Fallback rate returned
- **Cause**: No active courier services in Scan2Ship
- **Solution**: Verify courier service configuration in Scan2Ship

### 4. Invalid Request Format
- **Response**: `400 Bad Request`
- **Cause**: Malformed request body
- **Solution**: Ensure request follows Shopify's format

## Monitoring & Analytics

### Events Tracked
1. **rate_requested**: When a rate request is made
2. **fallback_rate_used**: When fallback rate is used
3. **scan2ship_error**: When Scan2Ship API fails

### Logs to Monitor
- Rate request frequency
- Response times
- Error rates
- Fallback usage frequency

## Performance Considerations

### Timeout Handling
- Scan2Ship API calls have built-in timeout protection
- Fallback rates ensure checkout never fails
- Analytics tracking is non-blocking

### Caching (Future Enhancement)
- Consider caching courier services list
- Cache order configuration for better performance
- Implement rate caching for repeated requests

## Security Best Practices

1. **HMAC Verification**: Always verify Shopify's HMAC signature
2. **API Key Protection**: Store Scan2Ship API key securely
3. **Request Validation**: Validate all incoming data
4. **Error Handling**: Don't expose sensitive information in errors
5. **Rate Limiting**: Consider implementing rate limiting for production

## Troubleshooting

### Common Issues

1. **Rates not appearing in checkout**
   - Check carrier service registration
   - Verify webhook subscriptions
   - Check app installation status

2. **HMAC verification failing**
   - Verify `SHOPIFY_API_SECRET` is correct
   - Check request body format
   - Ensure signature header is present

3. **Scan2Ship integration not working**
   - Verify `SCAN2SHIP_API_KEY` is valid
   - Check `SCAN2SHIP_API_URL` is correct
   - Test Scan2Ship API endpoints directly

4. **Fallback rates always showing**
   - Check Scan2Ship API status
   - Verify courier services are active
   - Check network connectivity

### Debug Mode
Enable debug logging by setting:
```bash
NODE_ENV=development
```

This will provide detailed logs for troubleshooting.
