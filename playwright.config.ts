import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',workers:1,timeout:45000,use:{baseURL:'http://127.0.0.1:3000',headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),screenshot:'only-on-failure',trace:'retain-on-failure'},reporter:[['list'],['junit',{outputFile:'evidence/browser-tests.xml'}]]});
