import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Banner,
  InlineError,
  Spinner,
  Badge,
  Divider,
  List,
  Link,
} from "@shopify/polaris";
import { CheckCircleIcon, AlertTriangleIcon, InfoIcon } from "@shopify/polaris-icons";

// Types for getting started data
interface GettingStartedData {
  isCarrierServiceActive: boolean;
  hasRequiredPlan: boolean;
  planType: string;
  carrierServiceStatus: string;
  requirements: {
    plan: boolean;
    carrierService: boolean;
    webhooks: boolean;
    scopes: boolean;
  };
}

// Mock function to check Shopify plan eligibility
async function checkPlanEligibility(shop: string): Promise<{
  hasRequiredPlan: boolean;
  planType: string;
}> {
  // In a real implementation, you would check the shop's plan via GraphQL
  // For now, we'll return mock data
  return {
    hasRequiredPlan: true, // Mock: assume they have the required plan
    planType: "Shopify Plus", // Mock: assume they have Plus
  };
}

// Mock function to check carrier service status
async function checkCarrierServiceStatus(shop: string): Promise<{
  isActive: boolean;
  status: string;
}> {
  // In a real implementation, you would check via GraphQL
  return {
    isActive: true, // Mock: assume carrier service is active
    status: "Active",
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    // Check plan eligibility and carrier service status
    const [planCheck, carrierCheck] = await Promise.all([
      checkPlanEligibility(shop),
      checkCarrierServiceStatus(shop),
    ]);

    const data: GettingStartedData = {
      isCarrierServiceActive: carrierCheck.isActive,
      hasRequiredPlan: planCheck.hasRequiredPlan,
      planType: planCheck.planType,
      carrierServiceStatus: carrierCheck.status,
      requirements: {
        plan: planCheck.hasRequiredPlan,
        carrierService: carrierCheck.isActive,
        webhooks: true, // Mock: assume webhooks are configured
        scopes: true, // Mock: assume scopes are configured
      },
    };

    return json({ data, shop });
  } catch (error) {
    console.error("Error loading getting started data:", error);
    return json({
      data: {
        isCarrierServiceActive: false,
        hasRequiredPlan: false,
        planType: "Unknown",
        carrierServiceStatus: "Unknown",
        requirements: {
          plan: false,
          carrierService: false,
          webhooks: false,
          scopes: false,
        },
      },
      shop,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export default function GettingStarted() {
  const { data, shop, error } = useLoaderData<typeof loader>();

  if (error) {
    return (
      <Page title="Getting Started">
        <Layout>
          <div>
            <Banner status="critical" title="Error loading setup information">
              <InlineError message={error} />
            </Banner>
          </div>
        </Layout>
      </Page>
    );
  }

  const allRequirementsMet = Object.values(data.requirements).every(Boolean);
  const completionPercentage = Math.round(
    (Object.values(data.requirements).filter(Boolean).length / Object.keys(data.requirements).length) * 100
  );

  return (
    <Page title="Getting Started with Scan2Ship">
      <Layout>
        {/* Welcome Section */}
        <div>
          <Card sectioned>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <InfoIcon />
              <Text variant="headingLg" as="h2">Welcome to Scan2Ship for India 🇮🇳</Text>
            </div>
            <Text variant="bodyMd" as="p">
              Get your shipping rates live at checkout in just a few steps. This guide will help you 
              set up Scan2Ship for your Indian e-commerce store.
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Badge status={allRequirementsMet ? "success" : "attention"}>
                Setup Progress: {completionPercentage}%
              </Badge>
            </div>
          </Card>
        </div>

        {/* Plan Requirements */}
        <div>
          <Card sectioned>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {data.requirements.plan ? <CheckCircleIcon /> : <AlertTriangleIcon />}
              <Text variant="headingLg" as="h2">1. Shopify Plan Requirements</Text>
            </div>
            
            <Text variant="bodyMd" as="p" style={{ marginBottom: '16px' }}>
              <strong>Carrier-calculated shipping rates</strong> require a specific Shopify plan or billing arrangement:
            </Text>

            <List type="bullet">
              <List.Item>
                <strong>Shopify Plus:</strong> Full access to carrier-calculated rates
              </List.Item>
              <List.Item>
                <strong>Annual billing:</strong> Upgraded access to carrier-calculated rates
              </List.Item>
              <List.Item>
                <strong>Monthly plans:</strong> Limited access (may require upgrade)
              </List.Item>
            </List>

            <div style={{ marginTop: '16px' }}>
              <Banner 
                status={data.requirements.plan ? "success" : "warning"} 
                title={data.requirements.plan ? "Plan Check Passed" : "Plan Check Required"}
              >
                {data.requirements.plan ? (
                  <Text variant="bodyMd" as="p">
                    ✅ Your {data.planType} plan supports carrier-calculated rates.
                  </Text>
                ) : (
                  <div>
                    <Text variant="bodyMd" as="p">
                      ⚠️ Your current plan may not support carrier-calculated rates.
                    </Text>
                    <div style={{ marginTop: '12px' }}>
                      <Link url="https://help.shopify.com/en/manual/shipping/setting-up-and-managing-your-shipping/setting-up-shipping-rates#carrier-calculated-shipping" external>
                        Learn more about plan requirements
                      </Link>
                    </div>
                  </div>
                )}
              </Banner>
            </div>
          </Card>
        </div>

        {/* Carrier Service Registration */}
        <div>
          <Card sectioned>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {data.requirements.carrierService ? <CheckCircleIcon /> : <AlertTriangleIcon />}
              <Text variant="headingLg" as="h2">2. Carrier Service Registration</Text>
            </div>
            
            <Text variant="bodyMd" as="p" style={{ marginBottom: '16px' }}>
              Scan2Ship automatically registers as a <strong>Carrier Service</strong> with Shopify. 
              This allows us to provide live shipping rates at checkout.
            </Text>

            <div style={{ backgroundColor: '#f6f6f7', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <Text variant="bodyMd" as="p" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                How it works:
              </Text>
              <List type="number">
                <List.Item>Scan2Ship registers via GraphQL <code>carrierServiceCreate</code></List.Item>
                <List.Item>Shopify calls our <code>/carrier/rates</code> endpoint during checkout</List.Item>
                <List.Item>We return real-time rates from Indian carriers</List.Item>
                <List.Item>Customers see accurate shipping costs before purchase</List.Item>
              </List>
            </div>

            <div style={{ marginTop: '16px' }}>
              <Banner 
                status={data.requirements.carrierService ? "success" : "warning"} 
                title={data.requirements.carrierService ? "Carrier Service Active" : "Carrier Service Setup Required"}
              >
                {data.requirements.carrierService ? (
                  <Text variant="bodyMd" as="p">
                    ✅ Scan2Ship carrier service is active and ready to provide rates.
                  </Text>
                ) : (
                  <Text variant="bodyMd" as="p">
                    ⚠️ Carrier service setup is required. This happens automatically during app installation.
                  </Text>
                )}
              </Banner>
            </div>
          </Card>
        </div>

        {/* GraphQL vs REST */}
        <div>
          <Card sectioned>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <InfoIcon />
              <Text variant="headingLg" as="h2">3. API Architecture (GraphQL Only)</Text>
            </div>
            
            <Text variant="bodyMd" as="p" style={{ marginBottom: '16px' }}>
              <strong>Important:</strong> Scan2Ship uses <strong>GraphQL Admin API 2025-07</strong> exclusively. 
              REST API is legacy and not supported for new public apps.
            </Text>

            <div style={{ backgroundColor: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <Text variant="bodyMd" as="p" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Why GraphQL?
              </Text>
              <List type="bullet">
                <List.Item>More efficient data fetching</List.Item>
                <List.Item>Better type safety</List.Item>
                <List.Item>Future-proof architecture</List.Item>
                <List.Item>Required for new public apps</List.Item>
              </List>
            </div>

            <div style={{ backgroundColor: '#fff3e0', padding: '16px', borderRadius: '8px' }}>
              <Text variant="bodyMd" as="p" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Key GraphQL Operations:
              </Text>
              <List type="bullet">
                <List.Item><code>carrierServiceCreate</code> - Register our service</List.Item>
                <List.Item><code>fulfillmentOrders</code> - Get fulfillment data</List.Item>
                <List.Item><code>fulfillmentCreateV2</code> - Create fulfillments</List.Item>
              </List>
            </div>
          </Card>
        </div>

        {/* Webhooks & Scopes */}
        <div>
          <Card sectioned>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {data.requirements.webhooks && data.requirements.scopes ? <CheckCircleIcon /> : <AlertTriangleIcon />}
              <Text variant="headingLg" as="h2">4. Webhooks & Permissions</Text>
            </div>
            
            <Text variant="bodyMd" as="p" style={{ marginBottom: '16px' }}>
              Scan2Ship requires specific webhooks and permissions to sync orders and manage fulfillments.
            </Text>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <Text variant="bodyMd" as="p" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                  Required Webhooks:
                </Text>
                <List type="bullet">
                  <List.Item><code>ORDERS_CREATE</code> - Sync new orders</List.Item>
                  <List.Item><code>FULFILLMENTS_UPDATE</code> - Track fulfillment status</List.Item>
                  <List.Item><code>APP_UNINSTALLED</code> - Cleanup on removal</List.Item>
                </List>
              </div>
              <div>
                <Text variant="bodyMd" as="p" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                  Required Scopes:
                </Text>
                <List type="bullet">
                  <List.Item><code>read_orders</code> - Access order data</List.Item>
                  <List.Item><code>write_shipping</code> - Register carrier service</List.Item>
                  <List.Item><code>write_fulfillments</code> - Create fulfillments</List.Item>
                  <List.Item><code>read_locations</code> - Access store locations</List.Item>
                </List>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <Banner 
                status={data.requirements.webhooks && data.requirements.scopes ? "success" : "warning"} 
                title={data.requirements.webhooks && data.requirements.scopes ? "Permissions Configured" : "Permissions Setup Required"}
              >
                {data.requirements.webhooks && data.requirements.scopes ? (
                  <Text variant="bodyMd" as="p">
                    ✅ All required webhooks and permissions are configured.
                  </Text>
                ) : (
                  <Text variant="bodyMd" as="p">
                    ⚠️ Some webhooks or permissions may need to be configured.
                  </Text>
                )}
              </Banner>
            </div>
          </Card>
        </div>

        {/* Next Steps */}
        <div>
          <Card sectioned>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <CheckCircleIcon />
              <Text variant="headingLg" as="h2">5. Next Steps</Text>
            </div>
            
            {allRequirementsMet ? (
              <div>
                <Banner status="success" title="Setup Complete!">
                  <Text variant="bodyMd" as="p">
                    🎉 All requirements are met! Your Scan2Ship integration is ready to go.
                  </Text>
                </Banner>
                
                <div style={{ marginTop: '16px' }}>
                  <Text variant="bodyMd" as="p" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                    What happens next:
                  </Text>
                  <List type="bullet">
                    <List.Item>Test shipping rates in your store's checkout</List.Item>
                    <List.Item>Configure carrier preferences in the Carriers & Pickup page</List.Item>
                    <List.Item>Monitor order sync and fulfillment in the Dashboard</List.Item>
                    <List.Item>Use the Rates Sandbox to test different scenarios</List.Item>
                  </List>
                </div>
              </div>
            ) : (
              <div>
                <Banner status="warning" title="Setup Incomplete">
                  <Text variant="bodyMd" as="p">
                    ⚠️ Some requirements are not yet met. Please complete the setup steps above.
                  </Text>
                </Banner>
                
                <div style={{ marginTop: '16px' }}>
                  <Text variant="bodyMd" as="p" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                    To complete setup:
                  </Text>
                  <List type="bullet">
                    <List.Item>Ensure your Shopify plan supports carrier-calculated rates</List.Item>
                    <List.Item>Verify carrier service registration is active</List.Item>
                    <List.Item>Check that all required webhooks are configured</List.Item>
                    <List.Item>Confirm all necessary permissions are granted</List.Item>
                  </List>
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <Button primary onClick={() => window.location.href = '/app'}>
                Go to Dashboard
              </Button>
              <Button onClick={() => window.location.href = '/app/carriers'}>
                Configure Carriers
              </Button>
              <Button onClick={() => window.location.href = '/app/rates-sandbox'}>
                Test Rates
              </Button>
            </div>
          </Card>
        </div>

        {/* Help & Support */}
        <div>
          <Card sectioned>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <InfoIcon />
              <Text variant="headingLg" as="h2">Need Help?</Text>
            </div>
            
            <Text variant="bodyMd" as="p" style={{ marginBottom: '16px' }}>
              If you encounter any issues during setup, here are some helpful resources:
            </Text>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <Text variant="bodyMd" as="p" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                  Shopify Resources:
                </Text>
                <List type="bullet">
                  <List.Item>
                    <Link url="https://help.shopify.com/en/manual/shipping/setting-up-and-managing-your-shipping/setting-up-shipping-rates#carrier-calculated-shipping" external>
                      Carrier-calculated shipping guide
                    </Link>
                  </List.Item>
                  <List.Item>
                    <Link url="https://help.shopify.com/en/manual/shipping/setting-up-and-managing-your-shipping/setting-up-shipping-rates#third-party-shipping-calculators" external>
                      Third-party shipping calculators
                    </Link>
                  </List.Item>
                </List>
              </div>
              <div>
                <Text variant="bodyMd" as="p" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                  Scan2Ship Support:
                </Text>
                <List type="bullet">
                  <List.Item>Check the Webhooks & Health page for diagnostics</List.Item>
                  <List.Item>Use the Rates Sandbox to test your configuration</List.Item>
                  <List.Item>Review the Dashboard for real-time status</List.Item>
                </List>
              </div>
            </div>
          </Card>
        </div>
      </Layout>
    </Page>
  );
}
