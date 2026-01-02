/**
 * Tests for better-sqlite3 compatibility
 * 
 * Tests that better-sqlite3 v12.5.0 works correctly with Node.js v25:
 * - Database creation
 * - Table creation
 * - Data insertion
 * - Data querying
 * - Database cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('better-sqlite3 Integration', () => {
  let testDbPath;
  let db;

  beforeEach(() => {
    testDbPath = join(__dirname, `test-${Date.now()}.db`);
  });

  afterEach(() => {
    // Close database if open
    if (db) {
      try {
        db.close();
      } catch (error) {
        // Already closed
      }
      db = null;
    }

    // Cleanup test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Database Operations', () => {
    it('should create a database successfully', () => {
      db = new Database(testDbPath);
      expect(db).toBeDefined();
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should create tables', () => {
      db = new Database(testDbPath);
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
      
      // Verify table exists
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all();
      expect(tables.length).toBe(1);
      expect(tables[0].name).toBe('users');
    });

    it('should insert data', () => {
      db = new Database(testDbPath);
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
      
      const insert = db.prepare('INSERT INTO users (name) VALUES (?)');
      const result1 = insert.run('Alice');
      const result2 = insert.run('Bob');
      
      expect(result1.changes).toBe(1);
      expect(result2.changes).toBe(1);
    });

    it('should query data', () => {
      db = new Database(testDbPath);
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
      
      const insert = db.prepare('INSERT INTO users (name) VALUES (?)');
      insert.run('Alice');
      insert.run('Bob');
      
      const users = db.prepare('SELECT * FROM users').all();
      expect(users.length).toBe(2);
      expect(users[0].name).toBe('Alice');
      expect(users[1].name).toBe('Bob');
      expect(users[0].id).toBe(1);
      expect(users[1].id).toBe(2);
    });

    it('should handle prepared statements', () => {
      db = new Database(testDbPath);
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
      
      const insert = db.prepare('INSERT INTO users (name) VALUES (?)');
      insert.run('Alice');
      
      const getUser = db.prepare('SELECT * FROM users WHERE name = ?');
      const user = getUser.get('Alice');
      
      expect(user).toBeDefined();
      expect(user.name).toBe('Alice');
    });

    it('should handle transactions', () => {
      db = new Database(testDbPath);
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
      
      const insert = db.prepare('INSERT INTO users (name) VALUES (?)');
      const insertMany = db.transaction((users) => {
        for (const name of users) {
          insert.run(name);
        }
      });
      
      insertMany(['Alice', 'Bob', 'Charlie']);
      
      const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
      expect(count.count).toBe(3);
    });

    it('should close database properly', () => {
      db = new Database(testDbPath);
      expect(() => db.close()).not.toThrow();
      db = null; // Mark as closed for cleanup
    });

    it('should work with in-memory database', () => {
      const memDb = new Database(':memory:');
      memDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
      memDb.prepare('INSERT INTO test (value) VALUES (?)').run('test');
      
      const result = memDb.prepare('SELECT * FROM test').get();
      expect(result.value).toBe('test');
      
      memDb.close();
    });
  });

  describe('Node.js v25 Compatibility', () => {
    it('should work with current Node.js version', () => {
      // This test verifies we can use better-sqlite3 with Node.js v25
      expect(process.version).toMatch(/^v25\./);
      
      db = new Database(testDbPath);
      db.exec('CREATE TABLE compatibility_test (id INTEGER PRIMARY KEY, version TEXT)');
      db.prepare('INSERT INTO compatibility_test (version) VALUES (?)').run(process.version);
      
      const result = db.prepare('SELECT * FROM compatibility_test').get();
      expect(result.version).toBe(process.version);
    });
  });
});
