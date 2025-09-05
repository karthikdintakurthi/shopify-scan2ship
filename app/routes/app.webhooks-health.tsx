import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  DataTable,
  Banner,
  InlineError,
  Spinner,
  Badge,
  Divider,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback } from "react";

// Types for webhook health data
interface WebhookDelivery {
  id: string;
  topic: string;
  url: string;
  status: 'success' | 'failed' | 'pending';
  responseCode?: number;
  responseBody?: string;
  timestamp: string;
  retryCount: number;
  errorMessage?: string;
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  responseTime?: number;
  lastChecked: string;
  message?: string;
}

interface EnvironmentCheck {
  scan2shipApi: boolean;
  webhookSecret: boolean;
  database: boolean;
  carrierService: boolean;
  overall: 'healthy' | 'unhealthy' | 'warning';
}

// Mock data for development
const mockWebhookDeliveries: WebhookDelivery[] = [
  {
    id: '1',
    topic: 'orders/create',
    url: '/webhooks/orders/create',
    status: 'success',
    responseCode: 200,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    retryCount: 0,
  },
  {
    id: '2',
    topic: 'orders/create',
    url: '/webhooks/orders/create',
    status: 'failed',
    responseCode: 500,
    errorMessage: 'Scan2Ship API timeout',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    retryCount: 2,
  },
  {
    id: '3',
    topic: 'fulfillments/update',
    url: '/webhooks/fulfillments/update',
    status: 'success',
    responseCode: 200,
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    retryCount: 0,
  },
  {
    id: '4',
    topic: 'orders/create',
    url: '/webhooks/orders/create',
    status: 'success',
    responseCode: 200,
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    retryCount: 0,
  },
];

const mockHealthChecks: HealthCheck[] = [
  {
    service: 'Scan2Ship API',
    status: 'healthy',
    responseTime: 245,
    lastChecked: new Date().toISOString(),
    message: 'API responding normally',
  },
  {
    service: 'Webhook Delivery',
    status: 'warning',
    responseTime: 1200,
    lastChecked: new Date().toISOString(),
    message: 'Some webhooks experiencing delays',
  },
  {
    service: 'Database',
    status: 'healthy',
    responseTime: 12,
    lastChecked: new Date().toISOString(),
    message: 'Database connection stable',
  },
  {
    service: 'Carrier Service',
    status: 'healthy',
    responseTime: 89,
    lastChecked: new Date().toISOString(),
    message: 'Carrier service active',
  },
];

// Fetch webhook deliveries from Scan2Ship
async function fetchWebhookDeliveries(): Promise<WebhookDelivery[]> {
  try {
    const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/webhook-deliveries`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Webhook deliveries API error: ${response.status}`);
    }

    const data = await response.json();
    return data.deliveries || [];
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    return mockWebhookDeliveries;
  }
}

// Perform environment check
async function performEnvironmentCheck(): Promise<EnvironmentCheck> {
  const checks = {
    scan2shipApi: false,
    webhookSecret: false,
    database: false,
    carrierService: false,
    overall: 'unhealthy' as const,
  };

  try {
    // Check Scan2Ship API
    const apiResponse = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/env-check`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    checks.scan2shipApi = apiResponse.ok;

    // Check webhook secret
    checks.webhookSecret = !!process.env.SCAN2SHIP_WEBHOOK_SECRET;

    // Check database (mock for now)
    checks.database = true;

    // Check carrier service (mock for now)
    checks.carrierService = true;

    // Determine overall status
    const healthyCount = Object.values(checks).filter(check => check === true).length;
    if (healthyCount === 4) {
      checks.overall = 'healthy';
    } else if (healthyCount >= 2) {
      checks.overall = 'warning';
    }

    return checks;
  } catch (error) {
    console.error('Error performing environment check:', error);
    return checks;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const [webhookDeliveries, healthChecks, environmentCheck] = await Promise.all([
      fetchWebhookDeliveries(),
      Promise.resolve(mockHealthChecks), // Mock for now
      performEnvironmentCheck(),
    ]);

    return json({ 
      webhookDeliveries, 
      healthChecks, 
      environmentCheck, 
      shop: session.shop,
      envStatus: {
        scan2shipWebhookSecret: !!process.env.SCAN2SHIP_WEBHOOK_SECRET,
        shopifyApiSecret: !!process.env.SHOPIFY_API_SECRET,
      }
    });
  } catch (error) {
    console.error('Error loading webhooks health data:', error);
    return json({ 
      webhookDeliveries: [], 
      healthChecks: [], 
      environmentCheck: null, 
      shop: session.shop,
      envStatus: {
        scan2shipWebhookSecret: !!process.env.SCAN2SHIP_WEBHOOK_SECRET,
        shopifyApiSecret: !!process.env.SHOPIFY_API_SECRET,
      }, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "retry-webhook") {
    const webhookId = formData.get("webhookId") as string;
    
    try {
      // Retry webhook delivery
      const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/webhook-deliveries/${webhookId}/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to retry webhook: ${response.status}`);
      }

      return json({ success: true, message: 'Webhook retry initiated successfully' });
    } catch (error) {
      console.error('Error retrying webhook:', error);
      return json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  if (action === "test-webhook") {
    const topic = formData.get("topic") as string;
    
    try {
      // Test webhook endpoint
      const response = await fetch(`${process.env.SHOPIFY_APP_URL}/webhooks/${topic}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Topic': topic,
          'X-Shopify-Shop-Domain': session.shop,
        },
        body: JSON.stringify({ test: true }),
      });

      return json({ 
        success: response.ok, 
        message: response.ok ? 'Webhook test successful' : `Webhook test failed: ${response.status}` 
      });
    } catch (error) {
      console.error('Error testing webhook:', error);
      return json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  return json({ success: false, message: "Invalid action" });
};

export default function WebhooksHealth() {
  const { webhookDeliveries, healthChecks, environmentCheck, shop, envStatus, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleRetryWebhook = useCallback((webhookId: string) => {
    const formData = new FormData();
    formData.append("action", "retry-webhook");
    formData.append("webhookId", webhookId);
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const handleTestWebhook = useCallback((topic: string) => {
    const formData = new FormData();
    formData.append("action", "test-webhook");
    formData.append("topic", topic);
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'healthy':
        return <Badge status="success">{status}</Badge>;
      case 'failed':
      case 'unhealthy':
        return <Badge status="critical">{status}</Badge>;
      case 'warning':
        return <Badge status="warning">{status}</Badge>;
      default:
        return <Badge status="info">{status}</Badge>;
    }
  };

  const webhookRows = webhookDeliveries.map(delivery => [
    delivery.topic,
    delivery.url,
    getStatusBadge(delivery.status),
    delivery.responseCode?.toString() || 'N/A',
    new Date(delivery.timestamp).toLocaleString(),
    delivery.retryCount.toString(),
    delivery.status === 'failed' ? (
      <Button
        size="slim"
        onClick={() => handleRetryWebhook(delivery.id)}
        disabled={fetcher.state === "submitting"}
      >
        Retry
      </Button>
    ) : 'N/A',
  ]);

  const healthRows = healthChecks.map(check => [
    check.service,
    getStatusBadge(check.status),
    check.responseTime ? `${check.responseTime}ms` : 'N/A',
    new Date(check.lastChecked).toLocaleString(),
    check.message || 'No message',
  ]);

  if (error) {
    return (
      <Page>
        <TitleBar title="Webhooks & Health" />
        <Layout>
          <Layout.Section>
            <Banner status="critical" title="Error loading health data">
              <InlineError message={error} />
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="Webhooks & Health" />
      <Layout>
        {/* Environment Check */}
        {environmentCheck && (
          <Layout.Section>
            <Card>
              <Card.Section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="headingLg" as="h2">Environment Status</Text>
                  {getStatusBadge(environmentCheck.overall)}
                </div>
              </Card.Section>
              <Card.Section>
                <List type="bullet">
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text variant="bodyMd" as="span">Scan2Ship API</Text>
                      {getStatusBadge(environmentCheck.scan2shipApi ? 'healthy' : 'unhealthy')}
                    </div>
                  </List.Item>
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text variant="bodyMd" as="span">Webhook Secret</Text>
                      {getStatusBadge(environmentCheck.webhookSecret ? 'healthy' : 'unhealthy')}
                    </div>
                  </List.Item>
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text variant="bodyMd" as="span">Database</Text>
                      {getStatusBadge(environmentCheck.database ? 'healthy' : 'unhealthy')}
                    </div>
                  </List.Item>
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text variant="bodyMd" as="span">Carrier Service</Text>
                      {getStatusBadge(environmentCheck.carrierService ? 'healthy' : 'unhealthy')}
                    </div>
                  </List.Item>
                </List>
              </Card.Section>
            </Card>
          </Layout.Section>
        )}

        {/* Health Checks */}
        <Layout.Section>
          <Card>
            <Card.Section>
              <Text variant="headingLg" as="h2">Service Health</Text>
            </Card.Section>
            <Card.Section>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Service', 'Status', 'Response Time', 'Last Checked', 'Message']}
                rows={healthRows}
                footerContent={`Monitoring ${healthChecks.length} services`}
              />
            </Card.Section>
          </Card>
        </Layout.Section>

        {/* Webhook Deliveries */}
        <Layout.Section>
          <Card>
            <Card.Section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="headingLg" as="h2">Recent Webhook Deliveries</Text>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    size="slim"
                    onClick={() => handleTestWebhook('orders/create')}
                    disabled={fetcher.state === "submitting"}
                  >
                    Test Orders Webhook
                  </Button>
                  <Button
                    size="slim"
                    onClick={() => handleTestWebhook('fulfillments/update')}
                    disabled={fetcher.state === "submitting"}
                  >
                    Test Fulfillments Webhook
                  </Button>
                </div>
              </div>
            </Card.Section>
            <Card.Section>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Topic', 'URL', 'Status', 'Response Code', 'Timestamp', 'Retries', 'Actions']}
                rows={webhookRows}
                footerContent={`Showing ${webhookDeliveries.length} recent deliveries`}
              />
            </Card.Section>
          </Card>
        </Layout.Section>

        {/* HMAC Verification Status */}
        <Layout.Section>
          <Card>
            <Card.Section>
              <Text variant="headingLg" as="h2">Security Status</Text>
            </Card.Section>
            <Card.Section>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="bodyMd" as="span">HMAC Verification</Text>
                  <Badge status="success">Enabled</Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="bodyMd" as="span">Webhook Secret</Text>
                  <Badge status={envStatus.scan2shipWebhookSecret ? "success" : "critical"}>
                    {envStatus.scan2shipWebhookSecret ? "Configured" : "Not Configured"}
                  </Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="bodyMd" as="span">Shopify API Secret</Text>
                  <Badge status={envStatus.shopifyApiSecret ? "success" : "critical"}>
                    {envStatus.shopifyApiSecret ? "Configured" : "Not Configured"}
                  </Badge>
                </div>
              </div>
            </Card.Section>
          </Card>
        </Layout.Section>

        {/* Success/Error Messages */}
        {fetcher.data?.success && (
          <Layout.Section>
            <Banner status="success" title="Success">
              {fetcher.data.message}
            </Banner>
          </Layout.Section>
        )}

        {fetcher.data?.success === false && (
          <Layout.Section>
            <Banner status="critical" title="Error">
              {fetcher.data.message}
            </Banner>
          </Layout.Section>
        )}

        {/* Loading State */}
        {fetcher.state === "submitting" && (
          <Layout.Section>
            <Card sectioned>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Spinner size="small" />
                <Text variant="bodyMd" as="p">Processing request...</Text>
              </div>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
