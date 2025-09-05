# India-Specific Requirements for Scan2Ship

## Overview

This document outlines the India-specific requirements and guardrails implemented in the Scan2Ship Shopify app to ensure successful merchant onboarding and checkout experience.

## Getting Started Stepper

The app includes a comprehensive "Getting Started" page (`/app/getting-started`) that guides Indian merchants through the setup process with specific focus on:

### 1. Shopify Plan Requirements

**Carrier-calculated shipping rates** require specific Shopify plans or billing arrangements:

- **Shopify Plus**: Full access to carrier-calculated rates
- **Annual billing**: Upgraded access to carrier-calculated rates  
- **Monthly plans**: Limited access (may require upgrade)

**Implementation:**
- Plan eligibility detection via GraphQL
- Non-blocking warnings for unsupported plans
- Direct links to Shopify Help Center documentation
- Clear upgrade path guidance

**Shopify Help Center Links:**
- [Carrier-calculated shipping guide](https://help.shopify.com/en/manual/shipping/setting-up-and-managing-your-shipping/setting-up-shipping-rates#carrier-calculated-shipping)
- [Third-party shipping calculators](https://help.shopify.com/en/manual/shipping/setting-up-and-managing-your-shipping/setting-up-shipping-rates#third-party-shipping-calculators)

### 2. Carrier Service Registration

**How it works:**
1. Scan2Ship automatically registers via GraphQL `carrierServiceCreate`
2. Shopify calls our `/carrier/rates` endpoint during checkout
3. We return real-time rates from Indian carriers
4. Customers see accurate shipping costs before purchase

**Technical Details:**
- Uses GraphQL Admin API 2025-07 exclusively
- REST API is legacy and not supported for new public apps
- Automatic registration during app installation
- Status monitoring and health checks

### 3. API Architecture (GraphQL Only)

**Why GraphQL?**
- More efficient data fetching
- Better type safety
- Future-proof architecture
- Required for new public apps

**Key GraphQL Operations:**
- `carrierServiceCreate` - Register our service
- `fulfillmentOrders` - Get fulfillment data
- `fulfillmentCreateV2` - Create fulfillments

### 4. Webhooks & Permissions

**Required Webhooks:**
- `ORDERS_CREATE` - Sync new orders to Scan2Ship
- `FULFILLMENTS_UPDATE` - Track fulfillment status
- `APP_UNINSTALLED` - Cleanup on removal

**Required Scopes:**
- `read_orders` - Access order data
- `write_shipping` - Register carrier service
- `write_fulfillments` - Create fulfillments
- `read_locations` - Access store locations

## India-Specific Features

### 1. Indian Carrier Support

The app is specifically designed for Indian e-commerce with support for:
- **Blue Dart** - Premium express delivery
- **DTDC** - Economy and express options
- **Delhivery** - Last-mile delivery specialist
- **Ecom Express** - E-commerce focused logistics
- **XpressBees** - Technology-driven logistics

### 2. Indian Address Format Support

- Proper handling of Indian postal codes (PIN codes)
- Support for Indian state and city names
- COD (Cash on Delivery) flag support
- Indian phone number format validation

### 3. Currency and Pricing

- All rates returned in Indian Rupees (INR)
- Proper handling of minor units (paise)
- Support for Indian tax calculations
- COD surcharge handling

## Setup Progress Tracking

The Getting Started page includes:
- **Progress indicator** showing completion percentage
- **Step-by-step validation** for each requirement
- **Visual status indicators** (✅ success, ⚠️ warning, ❌ error)
- **Action buttons** for next steps

## Error Handling & Guardrails

### 1. Plan Validation
- Automatic detection of plan eligibility
- Clear messaging about upgrade requirements
- Non-blocking warnings for unsupported plans
- Direct links to Shopify billing/upgrade pages

### 2. Carrier Service Health
- Real-time status monitoring
- Automatic retry mechanisms
- Fallback rate provision
- Health check endpoints

### 3. Webhook Reliability
- HMAC signature verification
- Retry with exponential backoff
- Dead letter queue for failed deliveries
- Comprehensive error logging

## User Experience

### 1. Onboarding Flow
1. **Welcome** - India-specific greeting and overview
2. **Plan Check** - Automatic validation with upgrade guidance
3. **Service Registration** - Explanation of carrier service setup
4. **API Architecture** - GraphQL vs REST explanation
5. **Permissions** - Webhook and scope requirements
6. **Next Steps** - Action items and navigation

### 2. Visual Design
- **India flag emoji** (🇮🇳) for localization
- **Color-coded status indicators** for quick understanding
- **Progressive disclosure** of technical details
- **Mobile-responsive** design for all devices

### 3. Help & Support
- **Contextual help** links throughout the flow
- **Shopify Help Center** integration
- **Scan2Ship support** resources
- **Diagnostic tools** for troubleshooting

## Technical Implementation

### 1. Plan Detection
```typescript
async function checkPlanEligibility(shop: string): Promise<{
  hasRequiredPlan: boolean;
  planType: string;
}> {
  // GraphQL query to check shop plan
  // Returns plan type and eligibility status
}
```

### 2. Carrier Service Status
```typescript
async function checkCarrierServiceStatus(shop: string): Promise<{
  isActive: boolean;
  status: string;
}> {
  // GraphQL query to check carrier service status
  // Returns active status and health
}
```

### 3. Progress Tracking
```typescript
const allRequirementsMet = Object.values(data.requirements).every(Boolean);
const completionPercentage = Math.round(
  (Object.values(data.requirements).filter(Boolean).length / 
   Object.keys(data.requirements).length) * 100
);
```

## Production Considerations

### 1. Real Implementation
- Replace mock functions with actual GraphQL queries
- Implement proper error handling and retry logic
- Add comprehensive logging and monitoring
- Set up alerting for critical failures

### 2. Performance
- Cache plan and service status checks
- Implement efficient GraphQL queries
- Use connection pooling for external APIs
- Monitor response times and optimize

### 3. Security
- Validate all user inputs
- Implement proper HMAC verification
- Use secure environment variables
- Regular security audits

## Testing

### 1. Plan Scenarios
- Test with different Shopify plans
- Verify upgrade path messaging
- Test plan change detection
- Validate error handling

### 2. Service Status
- Test carrier service registration
- Verify health check functionality
- Test failure scenarios
- Validate retry mechanisms

### 3. User Experience
- Test on different devices
- Verify accessibility compliance
- Test with different languages
- Validate navigation flow

## Monitoring & Analytics

### 1. Setup Completion
- Track completion rates by step
- Monitor drop-off points
- Analyze user behavior patterns
- Optimize based on data

### 2. Error Tracking
- Monitor plan validation failures
- Track carrier service issues
- Analyze webhook delivery problems
- Alert on critical failures

### 3. Performance Metrics
- Page load times
- API response times
- Error rates
- User satisfaction scores

## Future Enhancements

### 1. Localization
- Multi-language support
- Regional customization
- Local payment methods
- Cultural adaptations

### 2. Advanced Features
- AI-powered setup recommendations
- Automated troubleshooting
- Predictive error prevention
- Smart upgrade suggestions

### 3. Integration
- Third-party logistics providers
- Payment gateway integration
- Inventory management systems
- Customer support tools

## Conclusion

The India-specific requirements ensure that Indian merchants have a smooth onboarding experience with clear guidance on plan requirements, technical setup, and ongoing support. The implementation focuses on user experience, technical reliability, and comprehensive error handling to maximize merchant success.
