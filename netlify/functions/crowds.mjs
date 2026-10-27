import { getStore } from "@netlify/blobs";
import { createHostedCrowds, createCrowdHandler } from "../../lib/hosted-crowds.mjs";

export default createCrowdHandler(() => createHostedCrowds(getStore({
  name: "glide-crowds-v1", consistency: "strong"
})));

export const config = {
  path: "/api/crowds",
  rateLimit: { action: "rate_limit", aggregateBy: ["domain", "ip"], windowSize: 60, windowLimit: 60 }
};
