import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

export async function initializeDatabase() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Initialize Phase 1 schema (ignore errors from existing indexes)
    const schemaPath = path.join(__dirname, '../../scripts/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    try {
      await pool.query(schema);
    } catch (error: any) {
      if (error.code !== '42P07') { // Not "already exists" error
        throw error;
      }
    }
    
    // Initialize Phase 1 Webhook to Draft schema
    const phase1WebhookSchemaPath = path.join(__dirname, '../../scripts/database/phase1_webhook_schema.sql');
    if (fs.existsSync(phase1WebhookSchemaPath)) {
      const phase1WebhookSchema = fs.readFileSync(phase1WebhookSchemaPath, 'utf8');
      try {
        await pool.query(phase1WebhookSchema);
      } catch (error: any) {
        if (error.code !== '42P07' && error.code !== '42710') throw error;
      }
    }
    
    // Initialize Phase 2 schema
    const phase2SchemaPath = path.join(__dirname, '../../scripts/database/phase2_schema.sql');
    if (fs.existsSync(phase2SchemaPath)) {
      const phase2Schema = fs.readFileSync(phase2SchemaPath, 'utf8');
      try {
        await pool.query(phase2Schema);
      } catch (error: any) {
        if (error.code !== '42P07' && error.code !== '42710') throw error;
      }
    }
    
    // Initialize Phase 2.2 schema
    const phase2_2SchemaPath = path.join(__dirname, '../../scripts/database/phase2_2_schema.sql');
    if (fs.existsSync(phase2_2SchemaPath)) {
      const phase2_2Schema = fs.readFileSync(phase2_2SchemaPath, 'utf8');
      try {
        await pool.query(phase2_2Schema);
      } catch (error: any) {
        if (error.code !== '42P07' && error.code !== '42710') throw error;
      }
    }
    
    // Initialize Phase 2.3 schema
    const phase2_3SchemaPath = path.join(__dirname, '../../scripts/database/phase2_3_schema.sql');
    if (fs.existsSync(phase2_3SchemaPath)) {
      const phase2_3Schema = fs.readFileSync(phase2_3SchemaPath, 'utf8');
      try {
        await pool.query(phase2_3Schema);
      } catch (error: any) {
        if (error.code !== '42P07' && error.code !== '42710') throw error;
      }
    }
    
    // Initialize Phase 2.4 schema
    const phase2_4SchemaPath = path.join(__dirname, '../../scripts/database/phase2_4_schema.sql');
    if (fs.existsSync(phase2_4SchemaPath)) {
      const phase2_4Schema = fs.readFileSync(phase2_4SchemaPath, 'utf8');
      try {
        await pool.query(phase2_4Schema);
      } catch (error: any) {
        if (error.code !== '42P07' && error.code !== '42710') throw error;
      }
    }
    
    // Initialize Phase 3 Calendar schema
    const phase3CalendarSchemaPath = path.join(__dirname, '../../scripts/database/phase3_calendar_schema.sql');
    if (fs.existsSync(phase3CalendarSchemaPath)) {
      const phase3CalendarSchema = fs.readFileSync(phase3CalendarSchemaPath, 'utf8');
      try {
        await pool.query(phase3CalendarSchema);
      } catch (error: any) {
        if (error.code !== '42P07' && error.code !== '42710') throw error;
      }
    }
    
    // Initialize Phase 3.3 Auto-Scheduling schema
    const phase3_3SchemaPath = path.join(__dirname, '../../scripts/database/phase3_3_schema.sql');
    if (fs.existsSync(phase3_3SchemaPath)) {
      const phase3_3Schema = fs.readFileSync(phase3_3SchemaPath, 'utf8');
      try {
        await pool.query(phase3_3Schema);
      } catch (error: any) {
        if (error.code !== '42P07' && error.code !== '42710') throw error;
      }
    }

    // Initialize Phase 4: Persistent Authentication (24/7 operation)
    const persistentAuthSchemaPath = path.join(__dirname, '../../scripts/database/persistent_auth_schema.sql');
    if (fs.existsSync(persistentAuthSchemaPath)) {
      const persistentAuthSchema = fs.readFileSync(persistentAuthSchemaPath, 'utf8');
      try {
        await pool.query(persistentAuthSchema);
      } catch (error: any) {
        if (error.code !== '42P07' && error.code !== '42710') throw error;
      }
      console.log('✅ Database schema initialized (Phase 1-4: Full 24/7 AI Assistant)');
    } else if (fs.existsSync(phase3_3SchemaPath)) {
      console.log('✅ Database schema initialized (Phase 1 + 2 + 2.2 + 2.3 + 2.4 + 3 + 3.3 Auto-Scheduling)');
    } else if (fs.existsSync(phase3CalendarSchemaPath)) {
      console.log('✅ Database schema initialized (Phase 1 + 2 + 2.2 + 2.3 + 2.4 + 3 Calendar Intelligence)');
    } else if (fs.existsSync(phase2_4SchemaPath)) {
      console.log('✅ Database schema initialized (Phase 1 + 2 + 2.2 + 2.3 + 2.4 Learning System)');
    } else if (fs.existsSync(phase2_3SchemaPath)) {
      console.log('✅ Database schema initialized (Phase 1 + 2 + 2.2 + 2.3 Smart Response)');
    } else if (fs.existsSync(phase2_2SchemaPath)) {
      console.log('✅ Database schema initialized (Phase 1 + 2 + 2.2 Context Intelligence)');
    } else {
      console.log('✅ Database schema initialized (Phase 1 + 2)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
}