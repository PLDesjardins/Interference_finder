import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
 testDir:'./tests',testMatch:'*.spec.js',workers:1,
 use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1440,height:1000},launchOptions:{...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--enable-unsafe-swiftshader']}},
 webServer:{command:'npm run dev -- --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
});
