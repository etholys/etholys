# Etholys TypeScript SDK (lightweight)

## Usage

```ts
import { EtholysClient } from "./src/client";

const client = new EtholysClient({
  baseUrl: "http://127.0.0.1:8000",
  apiKey: "eth_xxx",
});

const me = await client.getMe();
console.log(me);

const chat = await client.chat("Hello from TypeScript SDK");
console.log(chat);
```
