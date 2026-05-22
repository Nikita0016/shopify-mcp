import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

app.get("/", (req, res) => {
  res.send("Shopify MCP Server Running");
});
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const response = await fetch(
      `https://${SHOP}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_CLIENT_ID,
          client_secret: process.env.SHOPIFY_CLIENT_SECRET,
          code
        })
      }
    );

    const data = await response.json();

    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.get("/orders", async (req, res) => {
  try {
    const response = await fetch(
      `https://${SHOP}/admin/api/2025-01/orders.json?limit=20`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/products", async (req, res) => {
  try {
    const response = await fetch(
      `https://${SHOP}/admin/api/2025-01/products.json?limit=20`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
