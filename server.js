{\rtf1\ansi\ansicpg936\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import express from "express";\
import fetch from "node-fetch";\
\
const app = express();\
app.use(express.json());\
\
const SHOP = process.env.SHOPIFY_SHOP;\
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;\
\
app.get("/", (req, res) => \{\
  res.send("Shopify MCP Server Running");\
\});\
\
app.get("/orders", async (req, res) => \{\
  try \{\
    const response = await fetch(\
      `https://$\{SHOP\}/admin/api/2025-01/orders.json?limit=20`,\
      \{\
        headers: \{\
          "X-Shopify-Access-Token": TOKEN,\
          "Content-Type": "application/json",\
        \},\
      \}\
    );\
\
    const data = await response.json();\
    res.json(data);\
  \} catch (err) \{\
    res.status(500).json(\{ error: err.message \});\
  \}\
\});\
\
const PORT = process.env.PORT || 3000;\
\
app.listen(PORT, () => \{\
  console.log(`Server running on $\{PORT\}`);\
\});}