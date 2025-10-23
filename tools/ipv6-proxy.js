#!/usr/bin/env node
// Simple TCP forwarder: listens on an IPv4 interface and forwards to an IPv6 target
// Usage: node tools/ipv6-proxy.js <listenPort> <targetIPv6> [targetPort]

import net from 'net';

const listenPort = process.argv[2] ? parseInt(process.argv[2], 10) : 5432;
const targetHost = process.argv[3] || process.env.TARGET_IPV6;
const targetPort = process.argv[4] ? parseInt(process.argv[4], 10) : (process.env.TARGET_PORT ? parseInt(process.env.TARGET_PORT,10) : 5432);

if(!targetHost){
  console.error('Usage: node tools/ipv6-proxy.js <listenPort> <targetIPv6> [targetPort]');
  process.exit(2);
}

const server = net.createServer((client) => {
  const remote = net.createConnection({ host: targetHost, port: targetPort, family: 6 }, () => {
    client.pipe(remote);
    remote.pipe(client);
  });
  remote.on('error', (err) => { console.error('[proxy] remote error', err && err.message); client.destroy(); });
  client.on('error', () => remote.destroy());
});

server.on('error', (err) => { console.error('[proxy] server error', err && err.message); process.exit(1); });
server.listen(listenPort, '0.0.0.0', () => console.log(`[proxy] listening on 0.0.0.0:${listenPort} -> [${targetHost}]:${targetPort}`));
