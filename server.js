import express from "express";

const app = express();

const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

function checkApiKey(req, res) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function shopifyFetch(url) {
  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json();
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
    const days = Number(req.query.days || 30);
    const createdAtMin = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let url = `https://${SHOP}/admin/api/2025-01/orders.json?status=any&limit=250&created_at_min=${createdAtMin}`;
    let ordersCount = 0;
    let totalSales = 0;
    const productMap = {};

    while (url) {
      const { data, link } = await shopifyFetch(url);
      const orders = data.orders || [];

      for (const order of orders) {
        ordersCount += 1;
        totalSales += Number(order.current_total_price || order.total_price || 0);

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
      period_days: days,
      orders_count: ordersCount,
      total_sales: Number(totalSales.toFixed(2)),
      top_products: products
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
