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
  TextField,
  Form,
  FormLayout,
  Banner,
  InlineError,
  Spinner,
  Modal,
  Select,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback } from "react";

// Types for carriers and pickup locations
interface CourierService {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  supportedCountries: string[];
  estimatedDeliveryDays: number;
  baseRate: number;
  currency: string;
}

interface PickupLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone?: string;
  email?: string;
  enabled: boolean;
}

// Fetch courier services from Scan2Ship
async function fetchCourierServices(): Promise<CourierService[]> {
  try {
    const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/courier-services`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Courier services API error: ${response.status}`);
    }

    const data = await response.json();
    return data.services || [];
  } catch (error) {
    console.error('Error fetching courier services:', error);
    // Return mock data for development
    return [
      {
        id: '1',
        name: 'Blue Dart',
        code: 'BLUEDART',
        enabled: true,
        supportedCountries: ['IN'],
        estimatedDeliveryDays: 2,
        baseRate: 150,
        currency: 'INR',
      },
      {
        id: '2',
        name: 'DTDC',
        code: 'DTDC',
        enabled: false,
        supportedCountries: ['IN'],
        estimatedDeliveryDays: 3,
        baseRate: 120,
        currency: 'INR',
      },
      {
        id: '3',
        name: 'FedEx',
        code: 'FEDEX',
        enabled: true,
        supportedCountries: ['IN', 'US', 'UK'],
        estimatedDeliveryDays: 1,
        baseRate: 500,
        currency: 'INR',
      },
    ];
  }
}

// Fetch pickup locations from Scan2Ship
async function fetchPickupLocations(): Promise<PickupLocation[]> {
  try {
    const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/pickup-locations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Pickup locations API error: ${response.status}`);
    }

    const data = await response.json();
    return data.locations || [];
  } catch (error) {
    console.error('Error fetching pickup locations:', error);
    // Return mock data for development
    return [
      {
        id: '1',
        name: 'Mumbai Warehouse',
        address: '123 Industrial Area',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'IN',
        postalCode: '400001',
        phone: '+91-22-12345678',
        email: 'mumbai@example.com',
        enabled: true,
      },
      {
        id: '2',
        name: 'Delhi Distribution Center',
        address: '456 Business Park',
        city: 'New Delhi',
        state: 'Delhi',
        country: 'IN',
        postalCode: '110001',
        phone: '+91-11-87654321',
        email: 'delhi@example.com',
        enabled: false,
      },
    ];
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const [courierServices, pickupLocations] = await Promise.all([
      fetchCourierServices(),
      fetchPickupLocations(),
    ]);

    return json({ courierServices, pickupLocations, shop: session.shop });
  } catch (error) {
    console.error('Error loading carriers data:', error);
    return json({ 
      courierServices: [], 
      pickupLocations: [], 
      shop: session.shop, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  try {
    if (action === "toggle-courier") {
      const courierId = formData.get("courierId") as string;
      const enabled = formData.get("enabled") === "true";
      
      // Update courier service status
      const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/courier-services/${courierId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update courier service: ${response.status}`);
      }

      return json({ success: true, message: `Courier service ${enabled ? 'enabled' : 'disabled'} successfully` });
    }

    if (action === "toggle-location") {
      const locationId = formData.get("locationId") as string;
      const enabled = formData.get("enabled") === "true";
      
      // Update pickup location status
      const response = await fetch(`${process.env.SCAN2SHIP_API_URL}/api/pickup-locations/${locationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.SCAN2SHIP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update pickup location: ${response.status}`);
      }

      return json({ success: true, message: `Pickup location ${enabled ? 'enabled' : 'disabled'} successfully` });
    }

    return json({ success: false, message: "Invalid action" });
  } catch (error) {
    console.error('Error in carriers action:', error);
    return json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export default function Carriers() {
  const { courierServices, pickupLocations, shop, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: 'IN',
    postalCode: '',
    phone: '',
    email: '',
  });

  const handleCourierToggle = useCallback((courierId: string, enabled: boolean) => {
    const formData = new FormData();
    formData.append("action", "toggle-courier");
    formData.append("courierId", courierId);
    formData.append("enabled", enabled.toString());
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const handleLocationToggle = useCallback((locationId: string, enabled: boolean) => {
    const formData = new FormData();
    formData.append("action", "toggle-location");
    formData.append("locationId", locationId);
    formData.append("enabled", enabled.toString());
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const handleAddLocation = useCallback(() => {
    // TODO: Implement add location functionality
    setShowAddLocationModal(false);
    setNewLocation({
      name: '',
      address: '',
      city: '',
      state: '',
      country: 'IN',
      postalCode: '',
      phone: '',
      email: '',
    });
  }, []);

  // Prepare data for DataTable
  const courierRows = courierServices.map(service => [
    service.name,
    service.code,
    service.supportedCountries.join(', '),
    `${service.estimatedDeliveryDays} days`,
    `${service.baseRate} ${service.currency}`,
    service.enabled ? 'Enabled' : 'Disabled',
  ]);

  const locationRows = pickupLocations.map(location => [
    location.name,
    `${location.address}, ${location.city}, ${location.state} ${location.postalCode}`,
    location.country,
    location.phone || 'N/A',
    location.enabled ? 'Enabled' : 'Disabled',
  ]);

  if (error) {
    return (
      <Page>
        <TitleBar title="Carriers & Pickup" />
        <Layout>
          <div>
            <Banner status="critical" title="Error loading carriers data">
              <InlineError message={error} />
            </Banner>
          </div>
        </Layout>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="Carriers & Pickup Locations" />
      <Layout>
        {/* Courier Services */}
        <div>
          <Card>
            <Card.Section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="headingLg" as="h2">Courier Services</Text>
                <Button
                  onClick={() => window.location.reload()}
                  disabled={fetcher.state === "submitting"}
                >
                  Refresh
                </Button>
              </div>
            </Card.Section>
            <Card.Section>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Name', 'Code', 'Countries', 'Delivery Time', 'Base Rate', 'Enabled']}
                rows={courierRows}
                footerContent={`Showing ${courierServices.length} courier services`}
              />
            </Card.Section>
          </Card>
        </div>

        {/* Pickup Locations */}
        <div>
          <Card>
            <Card.Section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="headingLg" as="h2">Pickup Locations</Text>
                <Button
                  primary
                  onClick={() => setShowAddLocationModal(true)}
                  disabled={fetcher.state === "submitting"}
                >
                  Add Location
                </Button>
              </div>
            </Card.Section>
            <Card.Section>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Name', 'Address', 'Country', 'Phone', 'Enabled']}
                rows={locationRows}
                footerContent={`Showing ${pickupLocations.length} pickup locations`}
              />
            </Card.Section>
          </Card>
        </div>

        {/* Add Location Modal */}
        <Modal
          open={showAddLocationModal}
          onClose={() => setShowAddLocationModal(false)}
          title="Add Pickup Location"
          primaryAction={{
            content: 'Add Location',
            onAction: handleAddLocation,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setShowAddLocationModal(false),
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Location Name"
                value={newLocation.name}
                onChange={(value) => setNewLocation(prev => ({ ...prev, name: value }))}
                placeholder="e.g., Mumbai Warehouse"
              />
              <TextField
                label="Address"
                value={newLocation.address}
                onChange={(value) => setNewLocation(prev => ({ ...prev, address: value }))}
                placeholder="Street address"
                multiline={2}
              />
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="City"
                    value={newLocation.city}
                    onChange={(value) => setNewLocation(prev => ({ ...prev, city: value }))}
                    placeholder="Mumbai"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="State"
                    value={newLocation.state}
                    onChange={(value) => setNewLocation(prev => ({ ...prev, state: value }))}
                    placeholder="Maharashtra"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Postal Code"
                    value={newLocation.postalCode}
                    onChange={(value) => setNewLocation(prev => ({ ...prev, postalCode: value }))}
                    placeholder="400001"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Select
                    label="Country"
                    options={[
                      { label: 'India', value: 'IN' },
                      { label: 'United States', value: 'US' },
                      { label: 'United Kingdom', value: 'UK' },
                    ]}
                    value={newLocation.country}
                    onChange={(value) => setNewLocation(prev => ({ ...prev, country: value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Phone"
                    value={newLocation.phone}
                    onChange={(value) => setNewLocation(prev => ({ ...prev, phone: value }))}
                    placeholder="+91-22-12345678"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Email"
                    value={newLocation.email}
                    onChange={(value) => setNewLocation(prev => ({ ...prev, email: value }))}
                    placeholder="location@example.com"
                  />
                </div>
              </div>
            </FormLayout>
          </Modal.Section>
        </Modal>

        {/* Success/Error Messages */}
        {fetcher.data?.success && (
          <div>
            <Banner status="success" title="Success">
              {fetcher.data.message}
            </Banner>
          </div>
        )}

        {fetcher.data?.success === false && (
          <div>
            <Banner status="critical" title="Error">
              {fetcher.data.message}
            </Banner>
          </div>
        )}

        {/* Loading State */}
        {fetcher.state === "submitting" && (
          <div>
            <Card sectioned>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Spinner size="small" />
                <Text variant="bodyMd" as="p">Updating settings...</Text>
              </div>
            </Card>
          </div>
        )}
      </Layout>
    </Page>
  );
}
