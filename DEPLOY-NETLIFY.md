# Publish Glide with Community Reporting

This deployment uses Netlify Functions and Netlify Blobs. Netlify supplies cloud storage credentials automatically. There is no OTP/email integration and no Supabase configuration is required. Entry uses an unverified tab-local profile.

## Upload

1. Extract `Glide-Hosted.zip`.
2. Upload **all extracted contents** to the root of the existing GitHub repository: `public`, `netlify`, `lib`, `package.json`, `package-lock.json`, and `netlify.toml`. Preserve the folder structure; the ZIP itself must not be the uploaded source.
3. Commit the changes. The Netlify site must be connected to this repository and branch.
4. Use the root `netlify.toml` configuration. For this prebuilt package the build command is empty, publish directory is `public`, functions directory is `netlify/functions`, and Node is 22. Clear an old custom base directory if one was set.
5. Trigger a new production deploy. A static drag-and-drop deployment of only `index.html` will NOT deploy Functions.
6. Check that the deploy includes the `crowds` and `cleanup-crowds` functions. No email-related environment variables or authentication functions are needed. Check the account's Functions/Blobs allowances and billing controls before public use.

The original full source ZIP uses the same Functions but builds the self-contained frontend with `node build-netlify.cjs` and publishes `netlify-site`. Do not mix the two sets of build settings.

## Verify After Deploy

Open `/api/crowds?from=gundavali&to=mukesh-patel`. Expect JSON with a `reports` array, not a 404 page.

Open Glide in two browsers, fill in each travel profile, then select Now and Safest. Submit a bus crowd report in both. After refresh or 15 seconds, expand the report list: it should show two reports. Updating one browser's report should not increase the count. Personal profile fields are never sent with reports.

## Storage and Privacy

Reports are shared site-wide and expire after 30 minutes. Ownership uses an anonymous browser token, not a phone number or verified account. Blobs stores only its SHA-256 digest, which is omitted from report responses. The API returns corridor, transport type, level and timestamp only.

An hourly scheduled Function deletes obsolete storage buckets. Expired records can remain stored for up to approximately 90 minutes, longer if cleanup is delayed; they are not displayed after 30 minutes. Removal immediately hides the report and writes a temporary tombstone to prevent an older report reappearing.

Netlify applies a 60-request/minute IP/domain limit. Writes require same-origin headers, JSON, valid saved places and transport type, a valid anonymous reporter token and at most 4 KB. This is public unverified reporting, not secure authentication. Resetting browser storage can create a new identity; moderation remains necessary.

Netlify deploy previews on the same site share the site-wide crowd store. Do not submit test reports on public previews unless you intend them to affect production, or use a separate Netlify site for staging.

## Troubleshooting

- **404 on /api/crowds:** Functions were not deployed; upload the complete package and use Git-connected deployment.
- **503:** the Function ran but storage failed. Check Functions logs and Blobs availability. The UI falls back to typical estimates.
- Phone-based entry does not verify identity. Do not configure email or OTP providers for this version.
- **429:** wait a minute before trying again.
- **400:** a starting place and destination from Glide's saved places are required.

Live cloud storage and platform rate limits must be verified after deployment in the owner's Netlify account. Local automated tests use an in-memory replacement for Blobs and cannot prove the account's cloud configuration.

References: https://docs.netlify.com/build/functions/get-started/ and https://docs.netlify.com/build/data-and-storage/netlify-blobs/
