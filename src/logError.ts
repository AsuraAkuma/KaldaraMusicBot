// Utility for logging error messages to daily log files in the logs directory.
import fs from 'fs';
import path from 'path';

export default async function logError(err: Error, filename: string) {
    console.log(err);
    const today = new Date();
    const errorFileName = path.resolve(`../logs/${today.getMonth()}-${today.getDate()}-${today.getFullYear()}_error.log`);
    if (!fs.existsSync(errorFileName)) {
        fs.writeFileSync(errorFileName, `Start of error log: ${today.toUTCString()}\nFormat: [Timestamp] [Filename] Error: ErrorMessage\n`, { flag: 'a' });
    }
    fs.writeFileSync(errorFileName, `\n[${today.toUTCString()}] [${filename.split("\\").slice(5).join("\\")}] ${err}\n`, { flag: 'a' });
}