const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION = '1.1.2';
const BASE_URL = `https://github.com/betterleaks/betterleaks/releases/download/v${VERSION}`;
const OUT_DIR = path.join(__dirname, '..', 'executables');

const ASSETS = [
    { asset: `betterleaks_${VERSION}_windows_x64.zip`, binary: `betterleaks_${VERSION}_windows_x64.exe`, format: 'zip' },
    { asset: `betterleaks_${VERSION}_windows_arm64.zip`, binary: `betterleaks_${VERSION}_windows_arm64.exe`, format: 'zip' },
    { asset: `betterleaks_${VERSION}_darwin_arm64.tar.gz`, binary: `betterleaks_${VERSION}_darwin_arm64`, format: 'tar' },
    { asset: `betterleaks_${VERSION}_darwin_x64.tar.gz`, binary: `betterleaks_${VERSION}_darwin_x64`, format: 'tar' },
    { asset: `betterleaks_${VERSION}_linux_x64.tar.gz`, binary: `betterleaks_${VERSION}_linux_x64`, format: 'tar' },
    { asset: `betterleaks_${VERSION}_linux_arm64.tar.gz`, binary: `betterleaks_${VERSION}_linux_arm64`, format: 'tar' },
];

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const get = url.startsWith('https') ? https.get : http.get;
        get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return download(res.headers.location, dest).then(resolve, reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
            }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    for (const { asset, binary, format } of ASSETS) {
        const url = `${BASE_URL}/${asset}`;
        const archivePath = path.join(OUT_DIR, asset);
        const binaryDest = path.join(OUT_DIR, binary);

        if (fs.existsSync(binaryDest)) {
            console.log(`Skipping ${binary} (already exists)`);
            continue;
        }

        console.log(`Downloading ${asset}...`);
        await download(url, archivePath);

        console.log(`Extracting ${asset}...`);
        if (format === 'zip') {
            execSync(`unzip -o "${archivePath}" -d "${OUT_DIR}"`, { stdio: 'inherit' });
            const extracted = path.join(OUT_DIR, 'betterleaks.exe');
            if (fs.existsSync(extracted)) {
                fs.renameSync(extracted, binaryDest);
            }
        } else {
            execSync(`tar -xzf "${archivePath}" -C "${OUT_DIR}"`, { stdio: 'inherit' });
            const extracted = path.join(OUT_DIR, 'betterleaks');
            if (fs.existsSync(extracted)) {
                fs.renameSync(extracted, binaryDest);
                fs.chmodSync(binaryDest, 0o755);
            }
        }

        fs.unlinkSync(archivePath);
        // Clean up stray files extracted from archives (LICENSE, README, etc.)
        for (const f of fs.readdirSync(OUT_DIR)) {
            if (!f.startsWith('betterleaks_')) {
                fs.unlinkSync(path.join(OUT_DIR, f));
            }
        }
        console.log(`Ready: ${binary}`);
    }

    console.log('All binaries downloaded.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
