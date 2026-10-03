// Creates all tables from the Sequelize models. Run: npm run db:migrate
// (use --force to drop and recreate every table)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sequelize } = require('../models');
sequelize.sync({ force: process.argv.includes('--force') })
  .then(() => { console.log('Tables are ready.'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
