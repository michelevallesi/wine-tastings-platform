
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3003;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(cors());
app.get('/health', async (req,res)=>{
  try {
    const db = await pool.query('SELECT NOW()');
    res.json({ status:'ok', service:'tasting-service', db_time: db.rows[0].now });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.listen(PORT,()=>console.log('tasting-service on',PORT));
module.exports = app;
