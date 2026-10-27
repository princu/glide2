import { getStore } from "@netlify/blobs";
import { createHostedCrowds } from "../../lib/hosted-crowds.mjs";

export default async () => {
  let deleted = 0;
  for (const name of ["glide-crowds-v1", "glide-crowds-v2"]) {
    deleted += await createHostedCrowds(getStore({ name, consistency: "strong" })).cleanup();
  }
  return Response.json({ deleted });
};

export const config = { schedule: "0 * * * *" };
