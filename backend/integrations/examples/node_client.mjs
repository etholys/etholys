const baseUrl = process.env.ETHOLYS_API_URL || "http://127.0.0.1:8000";
const adminToken = process.env.API_ADMIN_TOKEN || "change-me-admin-token";

const createResp = await fetch(`${baseUrl}/api-product/clients`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Admin-Token": adminToken,
  },
  body: JSON.stringify({ name: "Partner Node Demo", plan: "starter", rpm_limit: 60 }),
});

if (!createResp.ok) {
  throw new Error(`Failed to create client: ${createResp.status}`);
}

const createData = await createResp.json();
const apiKey = createData.api_key;

const meResp = await fetch(`${baseUrl}/api-product/me`, {
  headers: { "X-API-Key": apiKey },
});
if (!meResp.ok) {
  throw new Error(`Failed to call /api-product/me: ${meResp.status}`);
}
console.log("/api-product/me", await meResp.json());

const chatResp = await fetch(`${baseUrl}/ai/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  },
  body: JSON.stringify({ message: "Hello from Node external system" }),
});
if (!chatResp.ok) {
  throw new Error(`Failed to call /ai/chat: ${chatResp.status}`);
}
console.log("/ai/chat", await chatResp.json());
