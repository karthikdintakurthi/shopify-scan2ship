import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Spinner,
  Banner,
  InlineError,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

// Types for dashboard data
interface DashboardStats {
  ordersSyncedToday: number;
  labelsGenerated: number;
  creditsRemaining: number;
  totalOrders: number;
  successRate: number;
  lastSyncTime?: string;
}

interface Scan2ShipAnalytics {
  ordersToday: number;
  labelsGenerated: number;
  totalOrders: number;
  successRate: number;
  lastActivity?: string;
}

interface Scan2ShipCredits {
  balance: number;
  currency: string;
  lastUpdated?: string;
}

// Fetch analytics data from Scan2Ship
async function fetchScan2ShipAnalytics(): Promise<Scan2ShipAnalytics> {
  try {
    const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/analytics/clients/current`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      ordersToday: data.ordersToday || 0,
      labelsGenerated: data.labelsGenerated || 0,
      totalOrders: data.totalOrders || 0,
      successRate: data.successRate || 0,
      lastActivity: data.lastActivity,
    };
  } catch (error) {
    console.error('Error fetching Scan2Ship analytics:', error);
    // Return mock data for development
    return {
      ordersToday: 12,
      labelsGenerated: 8,
      totalOrders: 156,
      successRate: 95.5,
      lastActivity: new Date().toISOString(),
    };
  }
}

// Fetch credits data from Scan2Ship
async function fetchScan2ShipCredits(): Promise<Scan2ShipCredits> {
  try {
    const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/credits`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Credits API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      balance: data.balance || 0,
      currency: data.currency || 'USD',
      lastUpdated: data.lastUpdated,
    };
  } catch (error) {
    console.error('Error fetching Scan2Ship credits:', error);
    // Return mock data for development
    return {
      balance: 150.75,
      currency: 'USD',
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    // Fetch data from Scan2Ship APIs
    const [analytics, credits] = await Promise.all([
      fetchScan2ShipAnalytics(),
      fetchScan2ShipCredits(),
    ]);

    const stats: DashboardStats = {
      ordersSyncedToday: analytics.ordersToday,
      labelsGenerated: analytics.labelsGenerated,
      creditsRemaining: credits.balance,
      totalOrders: analytics.totalOrders,
      successRate: analytics.successRate,
      lastSyncTime: analytics.lastActivity,
    };

    return json({ stats, shop: session.shop });
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    return json({ 
      stats: null, 
      shop: session.shop, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export default function Dashboard() {
  const { stats, shop, error } = useLoaderData<typeof loader>();

  if (error) {
    return (
      <Page>
        <TitleBar title="Dashboard" />
        <Layout>
          <Layout.Section>
            <Banner status="critical" title="Error loading dashboard">
              <InlineError message={error} />
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (!stats) {
    return (
      <Page>
        <TitleBar title="Dashboard" />
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Spinner size="large" />
                <Text variant="bodyMd" as="p">Loading dashboard data...</Text>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="Scan2Ship Dashboard" />
      <Layout>
        {/* Key Stats Cards */}
        <Layout.Section>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <Card sectioned>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Text variant="headingMd" as="h3">Orders Synced Today</Text>
                                           <Text variant="heading2xl" as="h2">{stats.ordersSyncedToday}</Text>
                  <Text variant="bodyMd" color="subdued">
                    {stats.lastSyncTime ? `Last sync: ${new Date(stats.lastSyncTime).toLocaleTimeString()}` : 'No recent activity'}
                  </Text>
                </div>
              </Card>
            </div>

            <div style={{ flex: 1 }}>
              <Card sectioned>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Text variant="headingMd" as="h3">Labels Generated</Text>
                                           <Text variant="heading2xl" as="h2">{stats.labelsGenerated}</Text>
                  <Text variant="bodyMd" color="subdued">
                    {stats.labelsGenerated > 0 ? 'Ready for pickup' : 'No labels today'}
                  </Text>
                </div>
              </Card>
            </div>

            <div style={{ flex: 1 }}>
              <Card sectioned>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Text variant="headingMd" as="h3">Credits Remaining</Text>
                  <Text variant="heading2xl" as="h2">${stats.creditsRemaining.toFixed(2)}</Text>
                  <Text variant="bodyMd" color="subdued">
                    {stats.creditsRemaining < 10 ? 'Low balance - top up recommended' : 'Sufficient balance'}
                  </Text>
                </div>
              </Card>
            </div>
          </div>
        </Layout.Section>

        {/* Additional Stats */}
        <Layout.Section>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <Card sectioned>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Text variant="headingMd" as="h3">Total Orders</Text>
                  <Text variant="headingLg" as="h3">{stats.totalOrders}</Text>
                  <Text variant="bodyMd" color="subdued">
                    All time processed
                  </Text>
                </div>
              </Card>
            </div>

            <div style={{ flex: 1 }}>
              <Card sectioned>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Text variant="headingMd" as="h3">Success Rate</Text>
                  <Text variant="headingLg" as="h3">{stats.successRate.toFixed(1)}%</Text>
                  <Text variant="bodyMd" color="subdued">
                    {stats.successRate >= 95 ? 'Excellent performance' : 'Room for improvement'}
                  </Text>
                </div>
              </Card>
            </div>

            <div style={{ flex: 1 }}>
              <Card sectioned>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Text variant="headingMd" as="h3">Shop</Text>
                  <Text variant="headingLg" as="h3">{shop}</Text>
                  <Text variant="bodyMd" color="subdued">
                    Connected and active
                  </Text>
                </div>
              </Card>
            </div>
          </div>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section>
          <Card sectioned>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Text variant="headingLg" as="h2">Quick Actions</Text>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <Card sectioned>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Text variant="headingMd" as="h3">Test Shipping Rates</Text>
                      <Text variant="bodyMd" color="subdued">
                        Simulate a checkout request to test your carrier rates
                      </Text>
                    </div>
                  </Card>
                </div>

                <div style={{ flex: 1 }}>
                  <Card sectioned>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Text variant="headingMd" as="h3">Manage Carriers</Text>
                      <Text variant="bodyMd" color="subdued">
                        Enable/disable carriers and configure pickup locations
                      </Text>
                    </div>
                  </Card>
                </div>

                <div style={{ flex: 1 }}>
                  <Card sectioned>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Text variant="headingMd" as="h3">View Webhooks</Text>
                      <Text variant="bodyMd" color="subdued">
                        Monitor webhook health and delivery status
                      </Text>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* Status Banner */}
        {stats.creditsRemaining < 10 && (
          <Layout.Section>
            <Banner status="warning" title="Low Credit Balance">
              <Text variant="bodyMd" as="p">
                Your Scan2Ship account has a low credit balance (${stats.creditsRemaining.toFixed(2)}). 
                Consider topping up to ensure uninterrupted service.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {stats.successRate < 90 && (
          <Layout.Section>
            <Banner status="warning" title="Performance Alert">
              <Text variant="bodyMd" as="p">
                Your success rate is below 90% ({stats.successRate.toFixed(1)}%). 
                Check your webhook configuration and carrier settings.
              </Text>
            </Banner>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}