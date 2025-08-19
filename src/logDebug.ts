// Utility for logging debug messages to daily log files in the logs directory.
import fs from 'fs';
import path from 'path';

export default async function logDebug(msg: String) {
    console.log(msg);
    const today = new Date();
    const errorFileName = path.resolve(`../logs/${today.getMonth()}-${today.getDate()}-${today.getFullYear()}_debug.log`);
    if (!fs.existsSync(errorFileName)) {
        fs.writeFileSync(errorFileName, `Start of debug log: ${today.toUTCString()}\nFormat: [Timestamp] Message\n`, { flag: 'a' });
    }
    fs.writeFileSync(errorFileName, `\n[${today.toUTCString()}] ${msg}\n`, { flag: 'a' });
}