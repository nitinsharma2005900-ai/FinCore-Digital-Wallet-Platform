import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/integration/**/*.test.ts'],fileParallelism:false,testTimeout:30000,coverage:{include:['apps/api/src/ledger.ts','apps/api/src/providers.ts'],reporter:['text','json-summary','lcov']},reporters:['default',['junit',{outputFile:'evidence/node-tests.xml'}]]}});
