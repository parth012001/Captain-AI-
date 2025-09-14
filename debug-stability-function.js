// Debug Stability Calculation Function
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugStabilityFunction() {
  console.log('🔍 DEBUGGING STABILITY CALCULATION FUNCTION');
  console.log('=' .repeat(50));

  try {
    // Check what data we actually have
    console.log('\n1️⃣ Checking raw edit_analyses data...');
    const rawData = await pool.query(`
      SELECT edit_type, success_score, created_at, user_id,
             DATE_TRUNC('week', created_at) as week_start
      FROM edit_analyses 
      WHERE edit_type IN ('stable_pattern', 'unstable_pattern', 'drifting_pattern')
      ORDER BY edit_type, created_at;
    `);

    console.log('   Raw data found:');
    const dataByType = {};
    rawData.rows.forEach(row => {
      if (!dataByType[row.edit_type]) {
        dataByType[row.edit_type] = [];
      }
      dataByType[row.edit_type].push({
        success: row.success_score,
        created: row.created_at.toISOString().split('T')[0],
        week: row.week_start.toISOString().split('T')[0]
      });
    });

    Object.entries(dataByType).forEach(([type, data]) => {
      console.log(`\n      ${type}: ${data.length} records`);
      data.forEach((d, i) => {
        console.log(`        ${i + 1}. ${d.success}% on ${d.created} (week: ${d.week})`);
      });
    });

    // Test the function's weekly aggregation logic manually
    console.log('\n2️⃣ Testing weekly aggregation logic...');
    
    for (const editType of ['stable_pattern', 'unstable_pattern', 'drifting_pattern']) {
      console.log(`\n   📊 Testing ${editType}...`);
      
      // Replicate the function's logic step by step
      const weeklyData = await pool.query(`
        SELECT 
            DATE_TRUNC('week', ea.created_at) as week_start,
            AVG(ea.success_score) as week_avg_success,
            COUNT(*) as week_count
        FROM edit_analyses ea
        WHERE ea.edit_type = $1
            AND ea.created_at >= CURRENT_DATE - INTERVAL '8 weeks'
        GROUP BY DATE_TRUNC('week', ea.created_at)
        HAVING COUNT(*) >= 2
        ORDER BY week_start
      `, [editType]);

      console.log(`      Found ${weeklyData.rows.length} weekly aggregates:`);
      weeklyData.rows.forEach((week, i) => {
        const avg = parseFloat(week.week_avg_success).toFixed(1);
        console.log(`        Week ${i + 1}: ${week.week_start.toISOString().split('T')[0]} → ${avg}% (${week.week_count} records)`);
      });

      // Now test with the user_id filter (which the function uses)
      const testUserId = 'phase2-test-1757839238082';
      const weeklyDataWithUser = await pool.query(`
        SELECT 
            DATE_TRUNC('week', ea.created_at) as week_start,
            AVG(ea.success_score) as week_avg_success,
            COUNT(*) as week_count
        FROM edit_analyses ea
        WHERE ea.edit_type = $1
            AND ea.created_at >= CURRENT_DATE - INTERVAL '8 weeks'
            AND ea.user_id = $2
        GROUP BY DATE_TRUNC('week', ea.created_at)
        HAVING COUNT(*) >= 2
        ORDER BY week_start
      `, [editType, testUserId]);

      console.log(`      With user filter (${testUserId}): ${weeklyDataWithUser.rows.length} weekly aggregates`);
      weeklyDataWithUser.rows.forEach((week, i) => {
        const avg = parseFloat(week.week_avg_success).toFixed(1);
        console.log(`        Week ${i + 1}: ${week.week_start.toISOString().split('T')[0]} → ${avg}% (${week.week_count} records)`);
      });
    }

    // Test the function directly
    console.log('\n3️⃣ Testing calculate_pattern_stability function directly...');
    
    const testUserId = 'phase2-test-1757839238082';
    for (const editType of ['stable_pattern']) {
      console.log(`\n   🧮 Direct function call for ${editType}...`);
      
      try {
        // Test without user filter
        const resultNoUser = await pool.query(`
          SELECT * FROM calculate_pattern_stability('edit_type', $1, NULL)
        `, [editType]);

        console.log('      Without user filter:');
        if (resultNoUser.rows.length > 0) {
          const result = resultNoUser.rows[0];
          console.log(`        Stability: ${parseFloat(result.stability_score || 0).toFixed(3)}`);
          console.log(`        Variance: ${parseFloat(result.pattern_variance || 0).toFixed(3)}`);
          console.log(`        Weekly rates: ${result.weekly_rates || []}`);
        } else {
          console.log('        No results returned');
        }

        // Test with user filter
        const resultWithUser = await pool.query(`
          SELECT * FROM calculate_pattern_stability('edit_type', $1, $2)
        `, [editType, testUserId]);

        console.log('      With user filter:');
        if (resultWithUser.rows.length > 0) {
          const result = resultWithUser.rows[0];
          console.log(`        Stability: ${parseFloat(result.stability_score || 0).toFixed(3)}`);
          console.log(`        Variance: ${parseFloat(result.pattern_variance || 0).toFixed(3)}`);
          console.log(`        Weekly rates: ${result.weekly_rates || []}`);
        } else {
          console.log('        No results returned');
        }
      } catch (error) {
        console.log(`        ❌ Function call failed: ${error.message}`);
      }
    }

    console.log('\n✅ Debug completed');

  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Details:', error.message);
  } finally {
    await pool.end();
  }
}

debugStabilityFunction();