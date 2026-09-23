# Bookkeeping deployment runbook

This application is built locally by Komodo and served by Nginx. GitHub Actions validates each revision and a repository-level self-hosted runner calls an internal Komodo webhook after validation succeeds.

## Architecture and prerequisites

The host must already provide two external Docker networks:

```bash
docker network inspect cloudflared-tunnel-network
docker network inspect komodo-networks
```

- `cloudflared-tunnel-network` carries public application traffic between Cloudflare Tunnel and `bookkeeping`.
- `komodo-networks` carries control traffic between the Deployment Runner and Komodo.
- The application publishes no host port. Configure the Cloudflare Tunnel origin as `http://bookkeeping:80` on the `cloudflared-tunnel-network` network.
- Komodo and its webhook must not be exposed to the Internet. The runner reaches the webhook by Komodo's service name on the `komodo-networks` network.

## First manual application deployment

Keep the repository public and GitHub Pages available until the replacement site passes acceptance testing.

1. In Komodo, create an application Stack from this repository's `main` branch and `compose.yml`.
2. Configure Komodo to build the new image before replacing the current container.
3. Require the Compose healthcheck to become healthy before replacement. A failed build or unhealthy replacement must leave the current container running.
4. Attach the existing Cloudflare Tunnel service to `cloudflared-tunnel-network` and route the production hostname to `http://bookkeeping:80`.
5. Trigger the first deployment manually from Komodo.
6. Verify the public URL, response headers, PWA installation, update flow, and offline startup before changing repository visibility.

The application uses a single service, so a successful update may cause a few seconds of interruption.

## Deployment Runner bootstrap

Only create the runner after the repository has been made private. The runner is repository-scoped, uses the default `self-hosted` labels, and has no Docker socket, privileged mode, or host bind mounts.

1. Copy the example environment file:

   ```bash
   cp .env.runner.example .env.runner
   ```

2. In the private GitHub repository, open **Settings → Actions → Runners → New self-hosted runner** and generate the repository URL and one-hour registration token.
3. Put the URL and short-lived token in `.env.runner`. Do not commit this file.
4. Build and start the runner:

   ```bash
   docker compose --env-file .env.runner -f compose.runner.yml up --build -d
   ```

5. Confirm the repository reports the runner as online and inspect its logs:

   ```bash
   docker compose -f compose.runner.yml logs deployment-runner
   ```

6. Remove `RUNNER_REGISTRATION_TOKEN` from `.env.runner`, then recreate the container so the token is no longer present in its environment. The named `runner-state` volume retains the registration:

   ```bash
   docker compose --env-file .env.runner -f compose.runner.yml up -d --force-recreate
   ```

On restart, the container restores its existing registration from `runner-state`. If the registration is revoked or the volume is lost, remove the stale runner entry in GitHub and repeat the bootstrap with a new short-lived token.

### Runner upgrades

The runner Dockerfile pins both the official runner release and its SHA-256 checksum. The scheduled `update-runner.yml` workflow proposes both values in one pull request. After merging an update:

```bash
docker compose --env-file .env.runner -f compose.runner.yml build --pull deployment-runner
docker compose --env-file .env.runner -f compose.runner.yml up -d deployment-runner
```

Never replace the pinned values with a runtime `latest` download.

## Komodo webhook and GitHub Actions

1. In Komodo, create an internal deployment webhook for the application Stack. It must perform the same build-before-replace and health-gated deployment used by the manual deployment.
2. Give the webhook a URL resolvable from the runner on `komodo-networks`.
3. Store the complete authenticated URL as the private repository Actions secret `KOMODO_WEBHOOK_URL`.
4. Run the `Validate and deploy with Komodo` workflow with `workflow_dispatch`.

The workflow first runs `npm ci` and `npm run build` on a GitHub-hosted Node 24 runner. Only a successful validation job unlocks the self-hosted deploy job. The deploy job does not checkout or execute repository code; it only sends the webhook request.

Production workflow runs are serialized. A running deployment is never cancelled, while a newer queued run replaces the older pending run.

## Cutover from GitHub Pages

The new hostname has a different browser origin. Existing GitHub Pages IndexedDB data is intentionally not migrated; the new site starts with an empty database.

After the new site passes manual acceptance testing:

1. Change the GitHub repository visibility from public to private.
2. Confirm the old GitHub Pages deployment is unavailable. GitHub Free unpublishes it automatically; on plans that retain it, use **Settings → Pages → Unpublish site**.
3. Bootstrap the private repository runner and enable the webhook workflow as described above.

If the new site fails before this cutover, leave the public repository and GitHub Pages unchanged while correcting the deployment.

## Rollback

Old application images are not retained. To roll back after cutover:

1. Select the last known-good Git commit.
2. Configure Komodo to check out that commit.
3. Rebuild using the image tags and digests recorded in that commit.
4. Replace the faulty version only after the rebuilt container is healthy.

The browser database remains origin-local and is not changed by an application image rollback.

## Troubleshooting

- **Application is unreachable:** confirm both services share `cloudflared-tunnel-network`, the Tunnel origin is `http://bookkeeping:80`, and the application healthcheck is healthy.
- **Runner is offline:** inspect runner logs, outbound access to GitHub, membership in `komodo-networks`, and the persisted `runner-state` volume.
- **Webhook fails:** resolve the internal hostname from the runner container and verify `KOMODO_WEBHOOK_URL` was stored as a secret without logging it.
- **Runner version rejected:** merge the runner update PR, rebuild the runner image, and recreate the service while retaining `runner-state`.
- **PWA appears stale:** verify `index.html`, `manifest.webmanifest`, and `sw.js` return no-cache headers while hashed `/assets/` files are immutable.
