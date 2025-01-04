import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
    server: {
        port: 8080,
        open: true,
        https: {
            key: fs.readFileSync('../webtransport-server/key.pem'),
            cert: fs.readFileSync('../webtransport-server/cert.pem')
        }
    }
}); 