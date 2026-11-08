import express from "express";

const app = express();

function storeConfig(site) {
  if (site === "global") return { shop: process.env.SHOPIFY_GLOBAL_SHOP || process.env.SHOPIFY_SHOP, token: process.env.SHOPIFY_GLOBAL_ACCESS_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN };
  if (site === "japan") return { shop: process.env.SHOPIFY_JAPAN_SHOP, token: process.env.SHOPIFY_JAPAN_ACCESS_TOKEN };
  return null;
}

function checkApiKey(req, res) {
  const apiKey = req.headers["x-api-key"];
  if (!process.env.API_KEY || !apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function shopifyFetch(url, shop, token) {
  if (new URL(url).origin !== `https://${shop}`) throw new Error("Invalid pagination origin");
  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) throw new Error(`Shopify upstream HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.orders)) throw new Error("Invalid Shopify orders response");
  const link = response.headers.get("link");

  return { data, link };
}

function getNextUrl(linkHeader) {
  if (!linkHeader) return null;

  const links = linkHeader.split(",");
  const nextLink = links.find((link) => link.includes('rel="next"'));

  if (!nextLink) return null;

  const match = nextLink.match(/<([^>]+)>/);
  return match ? match[1] : null;
}

app.get("/", (req, res) => {
  res.send("Shopify MCP Server Running");
});

app.get("/product-sales", async (req, res) => {
  if (!checkApiKey(req, res)) return;

  try {
    const site = req.query.site || "global";
    const config = storeConfig(site);
    if (!config) return res.status(400).json({ error: "site must be global or japan" });
    if (!config.shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.shop) || !config.token) return res.status(503).json({ error: "Selected store is not configured" });
    const days = Number(req.query.days ?? 30);
    if (!Number.isInteger(days) || days < 1 || days > 365) return res.status(400).json({ error: "days must be an integer from 1 to 365" });
    const SHOP = config.shop;
    const createdAtMin = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let url = `https://${SHOP}/admin/api/2025-01/orders.json?status=any&limit=250&created_at_min=${createdAtMin}`;
    let ordersCount = 0;
    let totalSales = 0;
    const productMap = Object.create(null);

    while (url) {
      const { data, link } = await shopifyFetch(url, SHOP, config.token);
      const orders = data.orders || [];

      for (const order of orders) {
        ordersCount += 1;
        totalSales += Number(order.current_total_price ?? order.total_price ?? 0);

        for (const item of order.line_items || []) {
          const key = item.sku || item.title || item.name;

          if (!productMap[key]) {
            productMap[key] = {
              sku: item.sku || "",
              title: item.title || item.name || "",
              quantity: 0,
              sales: 0
            };
          }

          const quantity = Number(item.quantity || 0);
          const price = Number(item.price || 0);
          const discount = Number(item.total_discount || 0);

          productMap[key].quantity += quantity;
          productMap[key].sales += price * quantity - discount;
        }
      }

      url = getNextUrl(link);
    }

    const products = Object.values(productMap)
      .sort((a, b) => b.sales - a.sales)
      .map((p) => ({
        ...p,
        sales: Number(p.sales.toFixed(2))
      }));

    res.json({
      site,
      shop: SHOP,
      period_days: days,
      orders_count: ordersCount,
      total_sales: Number(totalSales.toFixed(2)),
      top_products: products
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const connectionStatus = {};
async function verifyConnection(site) {
  const config = storeConfig(site);
  if (!config?.shop || !config?.token || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.shop)) {
    return connectionStatus[site] = { site, ok: false, status: "not_configured" };
  }
  try {
    const response = await fetch(`https://${config.shop}/admin/api/2026-04/graphql.json`, {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": config.token },
      body: JSON.stringify({ query: "{ shop { myshopifyDomain currencyCode ianaTimezone } currentAppInstallation { accessScopes { handle } } orders(first: 1) { nodes { id } } }" })
    });
    const data = await response.json();
    if (!response.ok || data.errors?.length || !data.data?.shop || !data.data?.orders) {
      return connectionStatus[site] = { site, ok: false, status: "verification_failed", http_status: response.status, error_codes: (data.errors || []).map(e => e.extensions?.code || "GRAPHQL_ERROR") };
    }
    return connectionStatus[site] = { site, ok: true, status: "verified", shop: data.data.shop.myshopifyDomain, currency: data.data.shop.currencyCode, timezone: data.data.shop.ianaTimezone, scopes: data.data.currentAppInstallation?.accessScopes?.map(s => s.handle) || [], checked_at: new Date().toISOString() };
  } catch {
    return connectionStatus[site] = { site, ok: false, status: "network_or_response_error" };
  }
}
app.get("/connection-status", (req, res) => {
  if (!checkApiKey(req, res)) return;
  res.set("Cache-Control", "no-store");
  res.json({ stores: connectionStatus });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
  Promise.all(["global", "japan"].map(async site => {
    const result = await verifyConnection(site);
    console.log("SHOPIFY_CONNECTION_CHECK", JSON.stringify(result));
  }));
});
