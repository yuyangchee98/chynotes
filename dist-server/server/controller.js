"use strict";
/**
 * Server Controller
 *
 * Controls the HTTP server lifecycle from within the Electron app.
 * Used to start/stop the remote access server from Settings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
exports.stopServer = stopServer;
exports.getServerStatus = getServerStatus;
exports.isServerRunning = isServerRunning;
const node_server_1 = require("@hono/node-server");
const index_1 = require("./index");
const os_1 = require("os");
const DEFAULT_PORT = 60008;
let server = null;
let serverPort = DEFAULT_PORT;
/**
 * Get the Tailscale IP address if available
 */
function getTailscaleAddress() {
    const interfaces = (0, os_1.networkInterfaces)();
    // Tailscale interface is usually named 'utun' on macOS or 'tailscale0' on Linux
    // or has IP in 100.x.x.x range
    for (const [_name, addrs] of Object.entries(interfaces)) {
        if (!addrs)
            continue;
        for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
                // Check for Tailscale IP range (100.64.0.0/10 - CGNAT range used by Tailscale)
                if (addr.address.startsWith('100.')) {
                    return addr.address;
                }
            }
        }
    }
    return null;
}
/**
 * Get all LAN addresses
 */
function getLanAddresses() {
    const interfaces = (0, os_1.networkInterfaces)();
    const addresses = [];
    for (const addrs of Object.values(interfaces)) {
        if (!addrs)
            continue;
        for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
                // Skip Tailscale addresses
                if (!addr.address.startsWith('100.')) {
                    addresses.push(addr.address);
                }
            }
        }
    }
    return addresses;
}
/**
 * Start the HTTP server
 */
async function startServer(port = DEFAULT_PORT) {
    if (server) {
        // Already running
        return getServerStatus();
    }
    serverPort = port;
    const app = await (0, index_1.createServer)();
    return new Promise((resolve, reject) => {
        try {
            server = (0, node_server_1.serve)({
                fetch: app.fetch,
                port: serverPort,
            }, () => {
                console.log(`✅ Remote access server started on port ${serverPort}`);
                resolve(getServerStatus());
            });
        }
        catch (err) {
            reject(err);
        }
    });
}
/**
 * Stop the HTTP server
 */
async function stopServer() {
    if (!server) {
        return;
    }
    return new Promise((resolve) => {
        server.close(() => {
            console.log('🛑 Remote access server stopped');
            server = null;
            resolve();
        });
    });
}
/**
 * Get current server status
 */
function getServerStatus() {
    const running = server !== null;
    const tailscaleIp = getTailscaleAddress();
    const lanAddresses = getLanAddresses();
    return {
        running,
        port: serverPort,
        localUrl: running ? `http://localhost:${serverPort}` : null,
        tailscaleUrl: running && tailscaleIp ? `http://${tailscaleIp}:${serverPort}` : null,
        lanAddresses: running ? lanAddresses.map(ip => `http://${ip}:${serverPort}`) : [],
    };
}
/**
 * Check if server is running
 */
function isServerRunning() {
    return server !== null;
}
