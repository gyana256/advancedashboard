IPv6 -> IPv4 proxy for Supabase (quick guide)

When Supabase provides only an IPv6 (AAAA) address but your Render service cannot reach IPv6, run a tiny proxy on a host that has both IPv4 and IPv6 connectivity. The proxy listens on IPv4 and forwards TCP to the IPv6 address.

Files added
- `tools/ipv6-proxy.js` — Node TCP forwarder. Usage below.

Quick steps (fastest)
1. Provision a cheap VPS/droplet that has IPv6 outbound and a public IPv4 address (DigitalOcean, Hetzner, Linode, etc.). Use a single small instance.
2. Upload the repo or just `tools/ipv6-proxy.js` to the VPS.
3. Run (example):

```bash
# on the VPS (ensure node >= 18 is installed)
node tools/ipv6-proxy.js 5432 2406:da1a:6b0:f60c:a3b9:19f9:b2bc:d22b 5432
```

This will listen on all IPv4 interfaces on port 5432 and forward to the Supabase IPv6 address.

Security
- Restrict access with a firewall (ufw/iptables) to only allow connections from Render's IPs if possible.
- If you cannot restrict Render IPs, consider running the proxy on a non-standard port and limit by a security group.

Render env vars to set
- DATABASE_URL: postgres://postgres:<password>@<PROXY_IPV4>:<PORT>/postgres
  - Example: postgres://postgres:ENCODED_PW@1.2.3.4:5432/postgres
- PGSSL=1 (the client still negotiates TLS with Supabase through the proxy)
- ADMIN_PASSWORD=...
- (Optional) DATABASE_PROXY is not needed with this approach because you point DATABASE_URL at the proxy directly.

Notes
- The Postgres client negotiates TLS with the upstream server; the proxy is a TCP tunnel and does not terminate TLS.
- This is a pragmatic workaround until either Render enables IPv6 outbound for your service or Supabase provides an IPv4 endpoint.

If you'd like, I can:
- Provide a systemd unit file for running the proxy as a service on the VPS.
- Provide firewall (ufw) commands to restrict access to Render IPs (if you share them) or to a CIDR.
- Deploy a small droplet for you (instructions) and test connectivity.

Systemd unit example

Create `/etc/systemd/system/ipv6-proxy.service` on the VPS with:

```ini
[Unit]
Description=IPv6-to-IPv4 Postgres proxy
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=/usr/bin/node /srv/ipv6-proxy/tools/ipv6-proxy.js 5432 2406:da1a:6b0:f60c:a3b9:19f9:b2bc:d22b 5432
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Reload systemd and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ipv6-proxy.service
sudo journalctl -u ipv6-proxy -f
```

Firewall (ufw) example

Restrict access to the proxy to only a set of allowed IPv4 addresses (replace <ALLOWED_IP> with Render's outbound IPs or your office IP):

```bash
sudo ufw allow from <ALLOWED_IP> to any port 5432 proto tcp
sudo ufw enable
```

If you don't have specific IPs, consider running the proxy on a non-standard high port and limiting by firewall.

Deploy helper (quick droplet)

I've added `tools/proxy-deploy.sh` which automates installing Node, creating the proxy service, and enabling ufw on a fresh Ubuntu droplet.

Quick bootstrap (DigitalOcean example):

1. Create a small droplet (Ubuntu 22.04/24.04) in a provider that provides IPv6 (DigitalOcean/Hetzner/Linode).
2. On your machine, run the following (replace <TARGET_IPV6> with the AAAA address from `/api/debug/dns`):

```bash
ssh root@<DROPLET_IPV4> 'bash -s' -- < <(curl -fsSL https://raw.githubusercontent.com/<your-repo>/main/tools/proxy-deploy.sh) <<< "TARGET_IPV6=2406:da1a:6b0:f60c:a3b9:19f9:b2bc:d22b"
```

Or simpler: copy `tools/proxy-deploy.sh` to the droplet and run:

```bash
# on the droplet
sudo TARGET_IPV6=2406:da1a:6b0:f60c:a3b9:19f9:b2bc:d22b bash tools/proxy-deploy.sh
```

After the script runs it will print the droplet's public IPv4. Use that IPv4 in Render.

Exact Render environment variable to set once you have the droplet IPv4 (EXAMPLE):

DATABASE_URL=postgresql://postgres:<PASSWORD>@<DROPLET_IPV4>:5432/postgres
PGSSL=1
ADMIN_PASSWORD=<...>

Replace `<PASSWORD>` with your encoded password (already encoded earlier). Do NOT commit these values to source control; set them as secrets in Render.
