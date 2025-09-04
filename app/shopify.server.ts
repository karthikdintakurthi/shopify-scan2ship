import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Helper function to register/update carrier service
async function registerCarrierService(admin: any, appUrl: string) {
  const carrierServiceMutation = `
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
  `;

  try {
    const response = await admin.graphql(carrierServiceMutation, {
      variables: {
        name: "Scan2Ship",
        callbackUrl: `${appUrl}/carrier/rates`,
      },
    });

    const responseJson = await response.json();
    
    if (responseJson.data?.carrierServiceCreate?.userErrors?.length > 0) {
      console.error("Carrier service creation errors:", responseJson.data.carrierServiceCreate.userErrors);
    } else {
      console.log("Carrier service registered successfully:", responseJson.data?.carrierServiceCreate?.carrierService);
    }
  } catch (error) {
    console.error("Error registering carrier service:", error);
  }
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      // Register carrier service after successful authentication
      await registerCarrierService(admin, process.env.SHOPIFY_APP_URL || "");
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
