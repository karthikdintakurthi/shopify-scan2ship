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
  Form,
  FormLayout,
  TextField,
  Select,
  Banner,
  InlineError,
  Spinner,
  DataTable,
  Badge,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback } from "react";

// Types for rate testing
interface RateTestRequest {
  origin: {
    country: string;
    state: string;
    city: string;
    postalCode: string;
  };
  destination: {
    country: string;
    state: string;
    city: string;
    postalCode: string;
  };
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    weight: number;
    price: number;
  }>;
  currency: string;
}

interface RateTestResponse {
  rates: Array<{
    service_name: string;
    service_code: string;
    total_price: string;
    currency: string;
    min_delivery_date: string;
    max_delivery_date: string;
    description?: string;
  }>;
  request: RateTestRequest;
  timestamp: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return json({ shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "test-rates") {
    try {
      const rateRequest: RateTestRequest = {
        origin: {
          country: formData.get("originCountry") as string,
          state: formData.get("originState") as string,
          city: formData.get("originCity") as string,
          postalCode: formData.get("originPostalCode") as string,
        },
        destination: {
          country: formData.get("destinationCountry") as string,
          state: formData.get("destinationState") as string,
          city: formData.get("destinationCity") as string,
          postalCode: formData.get("destinationPostalCode") as string,
        },
        items: [
          {
            name: formData.get("itemName") as string,
            sku: formData.get("itemSku") as string,
            quantity: parseInt(formData.get("itemQuantity") as string),
            weight: parseInt(formData.get("itemWeight") as string),
            price: parseFloat(formData.get("itemPrice") as string),
          },
        ],
        currency: formData.get("currency") as string,
      };

      // Call our carrier rates endpoint
      const response = await fetch(`${process.env.SHOPIFY_APP_URL}/carrier/rates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': session.shop,
        },
        body: JSON.stringify({
          rate: rateRequest,
        }),
      });

      if (!response.ok) {
        throw new Error(`Rate test failed: ${response.status}`);
      }

      const data = await response.json();
      
      const rateResponse: RateTestResponse = {
        rates: data.rates || [],
        request: rateRequest,
        timestamp: new Date().toISOString(),
      };

      return json({ success: true, data: rateResponse });
    } catch (error) {
      console.error('Error testing rates:', error);
      return json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  return json({ success: false, message: "Invalid action" });
};

export default function RatesSandbox() {
  const { shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  
  const [formData, setFormData] = useState({
    // Origin
    originCountry: 'IN',
    originState: 'Maharashtra',
    originCity: 'Mumbai',
    originPostalCode: '400001',
    
    // Destination
    destinationCountry: 'IN',
    destinationState: 'Delhi',
    destinationCity: 'New Delhi',
    destinationPostalCode: '110001',
    
    // Item
    itemName: 'Sample Product',
    itemSku: 'SKU-001',
    itemQuantity: '1',
    itemWeight: '500',
    itemPrice: '29.99',
    
    // Currency
    currency: 'INR',
  });

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleTestRates = useCallback(() => {
    const form = new FormData();
    form.append("action", "test-rates");
    
    // Add all form fields
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, value);
    });
    
    fetcher.submit(form, { method: "post" });
  }, [formData, fetcher]);

  const rateRows = fetcher.data?.success ? fetcher.data.data.rates.map(rate => [
    rate.service_name,
    rate.service_code,
    `${rate.total_price} ${rate.currency}`,
    rate.min_delivery_date,
    rate.max_delivery_date,
    rate.description || 'No description',
  ]) : [];

  return (
    <Page>
      <TitleBar title="Rates Sandbox" />
      <Layout>
        {/* Test Form */}
        <Layout.Section>
          <Card>
            <Card.Section>
              <Text variant="headingLg" as="h2">Test Shipping Rates</Text>
              <Text variant="bodyMd" color="subdued" as="p">
                Simulate a checkout request to test your carrier rates endpoint
              </Text>
            </Card.Section>
            <Card.Section>
              <FormLayout>
                {/* Origin Address */}
                <Text variant="headingMd" as="h3">Origin Address</Text>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Country"
                      options={[
                        { label: 'India', value: 'IN' },
                        { label: 'United States', value: 'US' },
                        { label: 'United Kingdom', value: 'UK' },
                      ]}
                      value={formData.originCountry}
                      onChange={(value) => handleFieldChange('originCountry', value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="State"
                      value={formData.originState}
                      onChange={(value) => handleFieldChange('originState', value)}
                      placeholder="Maharashtra"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="City"
                      value={formData.originCity}
                      onChange={(value) => handleFieldChange('originCity', value)}
                      placeholder="Mumbai"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Postal Code"
                      value={formData.originPostalCode}
                      onChange={(value) => handleFieldChange('originPostalCode', value)}
                      placeholder="400001"
                    />
                  </div>
                </div>

                <Divider />

                {/* Destination Address */}
                <Text variant="headingMd" as="h3">Destination Address</Text>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Country"
                      options={[
                        { label: 'India', value: 'IN' },
                        { label: 'United States', value: 'US' },
                        { label: 'United Kingdom', value: 'UK' },
                      ]}
                      value={formData.destinationCountry}
                      onChange={(value) => handleFieldChange('destinationCountry', value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="State"
                      value={formData.destinationState}
                      onChange={(value) => handleFieldChange('destinationState', value)}
                      placeholder="Delhi"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="City"
                      value={formData.destinationCity}
                      onChange={(value) => handleFieldChange('destinationCity', value)}
                      placeholder="New Delhi"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Postal Code"
                      value={formData.destinationPostalCode}
                      onChange={(value) => handleFieldChange('destinationPostalCode', value)}
                      placeholder="110001"
                    />
                  </div>
                </div>

                <Divider />

                {/* Item Details */}
                <Text variant="headingMd" as="h3">Item Details</Text>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Product Name"
                      value={formData.itemName}
                      onChange={(value) => handleFieldChange('itemName', value)}
                      placeholder="Sample Product"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="SKU"
                      value={formData.itemSku}
                      onChange={(value) => handleFieldChange('itemSku', value)}
                      placeholder="SKU-001"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Quantity"
                      type="number"
                      value={formData.itemQuantity}
                      onChange={(value) => handleFieldChange('itemQuantity', value)}
                      placeholder="1"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Weight (grams)"
                      type="number"
                      value={formData.itemWeight}
                      onChange={(value) => handleFieldChange('itemWeight', value)}
                      placeholder="500"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Price"
                      type="number"
                      step="0.01"
                      value={formData.itemPrice}
                      onChange={(value) => handleFieldChange('itemPrice', value)}
                      placeholder="29.99"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Currency"
                      options={[
                        { label: 'Indian Rupee (INR)', value: 'INR' },
                        { label: 'US Dollar (USD)', value: 'USD' },
                        { label: 'British Pound (GBP)', value: 'GBP' },
                      ]}
                      value={formData.currency}
                      onChange={(value) => handleFieldChange('currency', value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    primary
                    onClick={handleTestRates}
                    disabled={fetcher.state === "submitting"}
                    loading={fetcher.state === "submitting"}
                  >
                    Test Rates
                  </Button>
                </div>
              </FormLayout>
            </Card.Section>
          </Card>
        </Layout.Section>

        {/* Results */}
        {fetcher.data?.success && (
          <Layout.Section>
            <Card>
              <Card.Section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="headingLg" as="h2">Rate Results</Text>
                  <Badge status="success">Success</Badge>
                </div>
              </Card.Section>
              <Card.Section>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                  headings={['Service Name', 'Service Code', 'Price', 'Min Delivery', 'Max Delivery', 'Description']}
                  rows={rateRows}
                  footerContent={`Found ${rateRows.length} shipping rates`}
                />
              </Card.Section>
            </Card>
          </Layout.Section>
        )}

        {/* Error Messages */}
        {fetcher.data?.success === false && (
          <Layout.Section>
            <Banner status="critical" title="Rate Test Failed">
              <InlineError message={fetcher.data.message} />
            </Banner>
          </Layout.Section>
        )}

        {/* Loading State */}
        {fetcher.state === "submitting" && (
          <Layout.Section>
            <Card sectioned>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Spinner size="large" />
                <Text variant="bodyMd" as="p">Testing rates...</Text>
              </div>
            </Card>
          </Layout.Section>
        )}

        {/* Request Details */}
        {fetcher.data?.success && (
          <Layout.Section>
            <Card>
              <Card.Section>
                <Text variant="headingMd" as="h3">Request Details</Text>
              </Card.Section>
              <Card.Section>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Text variant="bodyMd" as="p">
                    <strong>Timestamp:</strong> {new Date(fetcher.data.data.timestamp).toLocaleString()}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Origin:</strong> {fetcher.data.data.request.origin.city}, {fetcher.data.data.request.origin.state}, {fetcher.data.data.request.origin.country} {fetcher.data.data.request.origin.postalCode}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Destination:</strong> {fetcher.data.data.request.destination.city}, {fetcher.data.data.request.destination.state}, {fetcher.data.data.request.destination.country} {fetcher.data.data.request.destination.postalCode}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Item:</strong> {fetcher.data.data.request.items[0].name} (SKU: {fetcher.data.data.request.items[0].sku}) - {fetcher.data.data.request.items[0].quantity}x {fetcher.data.data.request.items[0].weight}g - {fetcher.data.data.request.items[0].price} {fetcher.data.data.request.currency}
                  </Text>
                </div>
              </Card.Section>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}