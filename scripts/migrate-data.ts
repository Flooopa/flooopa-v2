#!/usr/bin/env tsx
/**
 * One-time migration script: JSON files → Supabase
 *
 * Usage:
 *   npx tsx scripts/migrate-data.ts
 *
 * Prerequisites:
 *   - Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 *   - Run the SQL migration in Supabase first
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || '00000000-0000-0000-0000-000000000000';
const OWNER_USER_ID = process.env.OWNER_USER_ID || 'owner-user-id';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OLD_DATA_DIR = resolve(__dirname, '../..', 'ai-dashboard', 'backend', 'data');
const OLD_MEMORY_DIR = resolve(__dirname, '../..', 'ai-dashboard', 'backend', 'memory');

async function migrate() {
  console.log('🚀 Starting migration...');

  // 1. Create workspace member (owner)
  console.log('👤 Creating workspace owner...');
  await supabase.from('workspace_members').upsert({
    workspace_id: WORKSPACE_ID,
    user_id: OWNER_USER_ID,
    role: 'owner',
  });

  // 2. Migrate todos
  console.log('📋 Migrating todos...');
  try {
    const todosRaw = readFileSync(resolve(OLD_DATA_DIR, 'todos.json'), 'utf8');
    const todos = JSON.parse(todosRaw);
    if (Array.isArray(todos) && todos.length > 0) {
      const mapped = todos.map((t: Record<string, unknown>) => ({
        workspace_id: WORKSPACE_ID,
        type: t.type,
        text: t.text,
        file: t.file || '',
        line: t.line || null,
        assignee: t.assignee || '',
        priority: t.priority || 'medium',
        status: t.status || 'open',
        "order": t.order || 0,
        source: t.source || 'manual',
        created_at: t.timestamp ? new Date(t.timestamp as number).toISOString() : new Date().toISOString(),
        resolved_at: t.resolvedAt ? new Date(t.resolvedAt as number).toISOString() : null,
      }));

      const { error } = await supabase.from('todos').insert(mapped);
      if (error) console.error('Todo migration error:', error);
      else console.log(`  ✓ Migrated ${mapped.length} todos`);
    }
  } catch {
    console.log('  ⚠ No todos.json found or empty');
  }

  // 3. Migrate feed posts
  console.log('💬 Migrating feed posts...');
  try {
    const postsRaw = readFileSync(resolve(OLD_DATA_DIR, 'posts.json'), 'utf8');
    const posts = JSON.parse(postsRaw);
    if (Array.isArray(posts) && posts.length > 0) {
      const mapped = posts.map((p: Record<string, unknown>) => ({
        workspace_id: WORKSPACE_ID,
        author: p.author || 'dev',
        author_id: OWNER_USER_ID,
        content: p.content,
        type: p.type || 'manual',
        metadata: p.metadata || {},
        reactions: p.reactions || {},
        replies: p.replies || [],
        created_at: p.timestamp ? new Date(p.timestamp as number).toISOString() : new Date().toISOString(),
      }));

      const { error } = await supabase.from('feed_posts').insert(mapped);
      if (error) console.error('Feed migration error:', error);
      else console.log(`  ✓ Migrated ${mapped.length} feed posts`);
    }
  } catch {
    console.log('  ⚠ No posts.json found or empty');
  }

  // 4. Migrate memory
  console.log('🧠 Migrating memory...');
  try {
    const globalRaw = readFileSync(resolve(OLD_MEMORY_DIR, 'global.json'), 'utf8');
    const global = JSON.parse(globalRaw);
    await supabase.from('memory_global').upsert({
      user_id: OWNER_USER_ID,
      preferences: global.preferences || [],
      coding_style: global.codingStyle || '',
      active_systems: global.activeSystems || [],
      always_inject: global.alwaysInject || '',
    });
    console.log('  ✓ Migrated global memory');
  } catch {
    console.log('  ⚠ No global.json found');
  }

  try {
    const projectFiles = ['project-default.json']; // Add more if needed
    for (const file of projectFiles) {
      const projectRaw = readFileSync(resolve(OLD_MEMORY_DIR, file), 'utf8');
      const project = JSON.parse(projectRaw);
      await supabase.from('memory_projects').upsert({
        workspace_id: WORKSPACE_ID,
        name: project.name || 'default',
        game_name: project.gameName || null,
        language: project.language || null,
        stack: project.stack || null,
        decisions: project.decisions || [],
        known_bugs: project.knownBugs || [],
        architecture: project.architecture || [],
        service_structure: project.serviceStructure || [],
        remote_names: project.remoteNames || [],
        coding_style_prefs: project.codingStylePrefs || [],
      });
      console.log(`  ✓ Migrated project memory from ${file}`);
    }
  } catch {
    console.log('  ⚠ No project memory files found');
  }

  // 5. Initialize public view
  console.log('🌐 Initializing public view...');
  await supabase.from('public_views').upsert({
    workspace_id: WORKSPACE_ID,
    game_version: '1.0.0',
    roadmap: [],
    patch_notes: [],
    known_issues: [],
    is_public: true,
  });

  // 6. Initialize workspace state
  console.log('⚙️ Initializing workspace state...');
  await supabase.from('workspace_states').upsert({
    workspace_id: WORKSPACE_ID,
    auto_mode: false,
    active_todo_id: null,
  });

  console.log('✅ Migration complete!');
}

migrate().catch(console.error);
