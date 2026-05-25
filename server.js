import express from "express";

const app = express();

const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

app.get("/", (req, res) => {
  res.send("Shopify MCP Server Running");
});

app.get("/orders", async (req, res) => {

  const apiKey = req.headers["x-api-key"];

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  try {

    const response = await fetch(
      `https://${SHOP}/admin/api/2025-01/orders.json?limit=5`,
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

    res.status(500).json({
      error: err.message
    });

  }

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

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
