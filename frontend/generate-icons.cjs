const sharp = require('sharp');
const fs = require('fs');

async function generate() {
    console.log("Generating icons...");
    await sharp('public/logo.jpg').resize(192, 192).toFile('public/pwa-192x192.png');
    await sharp('public/logo.jpg').resize(512, 512).toFile('public/pwa-512x512.png');
    await sharp('public/logo.jpg').resize(512, 512).toFile('public/pwa-maskable-512x512.png');
    console.log("Done!");
}
generate();
