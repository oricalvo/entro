import unzipper from "unzipper";
import fs from "fs/promises";
import fs_OLD from "fs";

export async function unzipFile(zipFilePath: string, extractToPath: string) {
    const zipFileStream = fs_OLD.createReadStream(zipFilePath);

    await new Promise((resolve, reject) => {
        zipFileStream
            .pipe(unzipper.Extract({ path: extractToPath }))
            .on('finish', resolve)
            .on('error', reject);
    });
}

export function readTextFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, "utf8");
}
