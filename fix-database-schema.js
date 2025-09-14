// Database migration script to add user_id columns for user-scoped learning
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'chief_ai',
  user: 'parthahir',
  password: ''
});

async function migrateDatabaseSchema() {
  try {
    console.log('🔄 Starting database migration for user-scoped learning...\n');

    // 1. Add user_id to edit_analyses table
    console.log('1. Adding user_id column to edit_analyses table...');
    await pool.query(`
      ALTER TABLE edit_analyses 
      ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
    `);
    console.log('   ✅ edit_analyses.user_id column added');

    // 2. Add user_id to generated_responses table  
    console.log('2. Adding user_id column to generated_responses table...');
    await pool.query(`
      ALTER TABLE generated_responses 
      ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
    `);
    console.log('   ✅ generated_responses.user_id column added');

    // 3. Create indexes for performance
    console.log('3. Creating indexes for user_id columns...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_edit_analyses_user_id 
      ON edit_analyses(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_generated_responses_user_id 
      ON generated_responses(user_id);
    `);
    console.log('   ✅ Indexes created for performance');

    // 4. Verify the migration
    console.log('4. Verifying migration...');
    
    const editAnalysesSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'edit_analyses' 
      AND column_name = 'user_id';
    `);
    
    const generatedResponsesSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'generated_responses' 
      AND column_name = 'user_id';
    `);

    console.log('   edit_analyses user_id column:', editAnalysesSchema.rows[0] || 'NOT FOUND');
    console.log('   generated_responses user_id column:', generatedResponsesSchema.rows[0] || 'NOT FOUND');

    console.log('\n🎉 DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('✅ User-scoped learning database schema is now ready');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateDatabaseSchema();