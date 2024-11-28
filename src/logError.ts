import fs from 'fs';

export default async function logError(err: Error, filename: string) {
    console.log(err);
    const today = new Date();
    const errorFileName = `C:\\Github\\KaldaraMusicBot\\logs\\${today.getMonth()}-${today.getDate()}-${today.getFullYear()}_error.log`;
    if (!fs.existsSync(errorFileName)) {
        fs.writeFileSync(errorFileName, `Start of error log: ${today.toUTCString()}\nFormat: [Timestamp] [Filename] Error: ErrorMessage\n`, { flag: 'a' });
    }
    fs.writeFileSync(errorFileName, `\n[${today.toUTCString()}] [${filename.split("\\").slice(5).join("\\")}] ${err}\n`, { flag: 'a' });
}