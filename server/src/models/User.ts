import { Database } from '../utils/database.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { WorldMapModel } from './WorldMap.js';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_admin: boolean;
  is_active: boolean;
  available_boosters?: number;
  next_booster_time?: Date | null;
  boosters_opened_today?: number;
  last_booster_opened?: Date | null;
  berrys?: number;
  favorite_card_id?: string | null;
}

export interface UserCreate {
  username: string;
  password: string;
}

export interface UserUpdate {
  username?: string;
  password?: string;
  is_admin?: boolean;
  is_active?: boolean;
}

export class UserModel {
  static async create(userData: UserCreate): Promise<User> {
    const id = uuidv4();
    const password_hash = await bcrypt.hash(userData.password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

    await Database.run(
      `INSERT INTO users (id, username, password_hash)
       VALUES (?, ?, ?)`,
      [id, userData.username, password_hash]
    );

    const user = await this.findById(id);
    if (!user) {
      throw new Error('Erreur lors de la création de l\'utilisateur');
    }

    // Initialiser le nouveau joueur avec la première île et Luffy
    try {
      await WorldMapModel.unlockIsland(id, 'island_windmill_village');
      await WorldMapModel.unlockCrewMember(id, 'crew_luffy');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du nouveau joueur:', error);
      // On ne bloque pas la création même si l'initialisation échoue
    }

    return user;
  }

  static async findById(id: string): Promise<User | undefined> {
    const user = await Database.get(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [id]
    );

    if (!user) return undefined;

    // Convertir les dates
    return {
      ...user,
      next_booster_time: user.next_booster_time ? new Date(user.next_booster_time) : null,
      last_booster_opened: user.last_booster_opened ? new Date(user.last_booster_opened) : null
    } as User;
  }


  static async findByUsername(username: string): Promise<User | undefined> {
    return await Database.get<User>(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    );
  }

  static async verifyPassword(user: User, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password_hash);
  }

  static async updateLastLogin(id: string): Promise<void> {
    const now = new Date().toISOString();
    await Database.run(
      'UPDATE users SET last_login = ? WHERE id = ?',
      [now, id]
    );
  }

  static async update(id: string, updates: UserUpdate): Promise<User | undefined> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.username !== undefined) {
      fields.push('username = ?');
      values.push(updates.username);
    }

    if (updates.password !== undefined) {
      const password_hash = await bcrypt.hash(updates.password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
      fields.push('password_hash = ?');
      values.push(password_hash);
    }

    if (updates.is_admin !== undefined) {
      fields.push('is_admin = ?');
      values.push(updates.is_admin);
    }

    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      return await this.findById(id);
    }

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await Database.run(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return await this.findById(id);
  }

  static async delete(id: string): Promise<void> {
    // Soft delete
    const now = new Date().toISOString();
    await Database.run(
      'UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?',
      [now, id]
    );
  }

  static async list(limit: number = 50, offset: number = 0): Promise<User[]> {
    return await Database.all<User>(
      'SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
  }

  static async count(): Promise<number> {
    const result = await Database.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
    );
    return result?.count || 0;
  }

  static async getUserStats(userId: string) {
    const [collectionStats, openingsStats] = await Promise.all([
      Database.get(`
        SELECT
          COUNT(DISTINCT card_id) as unique_cards,
          SUM(quantity) as total_cards
        FROM user_collections
        WHERE user_id = ?
      `, [userId]),

      Database.get(`
        SELECT
          COUNT(*) as total_openings,
          COUNT(CASE WHEN DATE(opened_at) = DATE('now') THEN 1 END) as today_openings
        FROM booster_openings
        WHERE user_id = ?
      `, [userId])
    ]);

    return {
      unique_cards: collectionStats?.unique_cards || 0,
      total_cards: collectionStats?.total_cards || 0,
      total_openings: openingsStats?.total_openings || 0,
      today_openings: openingsStats?.today_openings || 0
    };
  }

  static async addBerrys(userId: string, amount: number): Promise<void> {
    const MAX_BERRYS = 999999999;
    await Database.run(`
      UPDATE users
      SET berrys = MIN(COALESCE(berrys, 0) + ?, ?)
      WHERE id = ?
    `, [amount, MAX_BERRYS, userId]);
  }
}