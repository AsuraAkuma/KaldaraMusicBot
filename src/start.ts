// Script to start the bot server and check if it is running. Used for development and deployment automation.

const { exec } = require('child_process');
const { port } = require('./config.json');
// Replace these with your server start command and check command
const startCommand = 'npx ts-node src/index.ts'; // Command to start the server

/**
 * Checks if the server is running.
 * @param {function} callback - The function to call with the result.
 */
async function checkServer(callback: any) {
    const testReq = await fetch(`http://127.0.0.1:${port}`, { method: 'GET', headers: { "Content-Type": 'application/json' } }).catch((err) => { console.log(err) });
    if (!testReq) {
        callback(false);
    } else {
        callback(true);
    }
}

/**
 * Starts the server.
 */
function startServer() {
    exec(startCommand, (err: any, stdout: any, stderr: any) => {
        if (err) {
            console.error('Error starting server:', stderr);
            return;
        }
    });
}
setInterval(() => {
    console.log('Attempting to restart server.');
    setTimeout(async () => {
        await fetch(`http://127.0.0.1:${port}/stop`, { method: 'GET', headers: { "Content-Type": 'application/json' } }).catch((err) => { });
    }, 5000);
}, 60 * 1000 * 60 * 12);

/**
 * Monitors the server and restarts it if it's down.
 */
function monitorServer() {
    checkServer((isRunning: any) => {
        if (!isRunning) {
            console.log('Kaldara Music bot is down. Restarting...');
            startServer();
        }
    });
}
monitorServer();
// Check every 10 seconds
setTimeout(() => {
    setInterval(monitorServer, 10000);
}, 60000);
