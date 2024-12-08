import { testConnection } from './db/db.js';

(async () => {
    await testConnection();
})();