import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { Database } from './utils/database.js';
import { MigrationManager } from './utils/migrations.js';
import { VegapullImporter } from './scripts/import-vegapull-data.js';
import { BoosterModel } from './models/Booster.js';
import { AchievementService } from './services/AchievementService.js';
import { AchievementModel } from './models/Achievement.js';
import { seedWorldMapData, updateIslandCoordinates, initializeExistingUsers } from './scripts/seed-world-map-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middlewares
import {
  securityHeaders,
  requestSizeLimit,
  sqlInjectionProtection,
  securityLogger,
  userAgentValidation,
  limitQueryParams,
  pathTraversalProtection
} from './middleware/security.js';

// Routes
import authRoutes from './routes/auth.js';
import cardRoutes from './routes/cards.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/users.js';
import leaderboardRoutes from './routes/leaderboard.js';
import notificationRoutes from './routes/notifications.js';
import marketplaceRoutes from './routes/marketplace.js';
import worldMapRoutes from './routes/worldMapRoutes.js';

const app = express();

// Trust proxy pour obtenir la vraie IP derrière Docker/reverse proxy
app.set('trust proxy', 1);

// Disable X-Powered-By header
app.disable('x-powered-by');

// Configuration CORS sécurisée
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS: Origine non autorisée: ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400, // 24 hours
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middlewares de sécurité - ORDRE IMPORTANT
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(cors(corsOptions));
app.use(securityHeaders);
app.use(requestSizeLimit(10 * 1024 * 1024)); // 10MB max
app.use(userAgentValidation);
app.use(limitQueryParams(100));
app.use(pathTraversalProtection);
app.use(securityLogger);

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 1000,
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Rate limiting strict pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 50, // Réduit à 10 en prod pour éviter le brute force
  message: {
    error: 'Trop de tentatives de connexion, veuillez réessayer plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate limiting pour les routes admin (modéré pour permettre le dashboard refresh)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 500, // Augmenté pour permettre le refresh du dashboard
  message: {
    error: 'Trop de requêtes admin, veuillez réessayer plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(cookieParser()); // Parser les cookies
app.use(express.json({ limit: '1mb' })); // Réduit à 1MB pour plus de sécurité
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sqlInjectionProtection); // Protection SQL injection après le parsing du body

// Middleware pour les logs en développement
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Routes avec rate limiters spécifiques
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api', cardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/world', worldMapRoutes);

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Route pour servir les fichiers statiques (images, etc.)
app.use('/images', express.static('public/images'));
app.use('/boosters', express.static('public/images/boosters'));

// Gestion des erreurs 404 - UNIQUEMENT pour les routes API
app.use((req, res, next) => {
  // Si la route commence par /api et n'a pas été gérée, retourner une erreur JSON
  if (req.path.startsWith('/api')) {
    res.status(404).json({
      error: 'Route API non trouvée',
      path: req.originalUrl
    });
  } else {
    // Pour les autres routes non trouvées, ne rien faire (ou servir une page 404 si besoin)
    next();
  }
});

// Gestionnaire d'erreurs global
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erreur non gérée:', error);

  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || error.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Erreur interne du serveur'
    : error.message || 'Erreur inconnue';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// Fonction d'initialisation
export const initializeApp = async (): Promise<express.Application> => {
  try {
    console.log('🚀 Initialisation de l\'application...');

    // Initialiser la base de données
    await Database.initialize();
    console.log('✅ Base de données initialisée');

    // Exécuter les migrations
    const migrationManager = new MigrationManager();
    await migrationManager.migrate();
    console.log('✅ Migrations terminées');

    // Vérifier si la base de données contient des boosters
    const boosterCount = await BoosterModel.count();
    console.log(`📊 Nombre de boosters dans la DB: ${boosterCount}`);

    // Si pas de boosters, tenter d'importer les données Vegapull
    if (boosterCount === 0) {
      console.log('📦 Aucun booster trouvé, tentative d\'importation Vegapull...');
      try {
        const importer = new VegapullImporter();
        await importer.importData();
        await importer.cleanup();
        console.log('✅ Importation Vegapull terminée avec succès');
      } catch (importError) {
        console.warn('⚠️ Impossible d\'importer les données Vegapull:', importError);
        console.warn('💡 Vous pouvez importer manuellement avec: npm run import-vegapull');
      }
    }

    // Initialiser les achievements
    console.log('🏆 Vérification et initialisation des achievements...');
    try {
      // Vérifier si les achievements de base existent
      const achievementCount = await Database.get<{ count: number }>(`
        SELECT COUNT(*) as count FROM achievements WHERE is_active = 1
      `);

      if (!achievementCount || achievementCount.count === 0) {
        console.log('📋 Aucun achievement trouvé, initialisation...');
        await AchievementService.initializeDefaultAchievements();
        await AchievementService.createAllBoosterAchievements();
        console.log('✅ Achievements initialisés avec succès');
      } else {
        console.log(`✅ ${achievementCount.count} achievements déjà présents`);

        // Vérifier si tous les boosters ont leurs achievements
        const boosterAchievementCount = await Database.get<{ count: number }>(`
          SELECT COUNT(*) as count FROM achievements WHERE type = 'booster_cards' AND is_active = 1
        `);

        const expectedBoosterAchievements = boosterCount * 3; // 3 achievements par booster

        if (boosterAchievementCount && boosterAchievementCount.count < expectedBoosterAchievements) {
          console.log(`📋 Achievements de boosters incomplets (${boosterAchievementCount.count}/${expectedBoosterAchievements}), mise à jour...`);
          await AchievementService.createAllBoosterAchievements();
          console.log('✅ Achievements de boosters mis à jour');
        }
      }
    } catch (achievementError) {
      console.warn('⚠️ Erreur lors de l\'initialisation des achievements:', achievementError);
      console.warn('💡 Vous pouvez initialiser manuellement avec: npm run init-achievements');
    }

    // Initialiser la carte du monde
    console.log('🗺️  Vérification et initialisation de la carte du monde...');
    try {
      const islandCount = await Database.get<{ count: number }>(`
        SELECT COUNT(*) as count FROM islands
      `);

      if (!islandCount || islandCount.count === 0) {
        console.log('🏝️  Aucune île trouvée, initialisation de la carte du monde...');
        await seedWorldMapData();
        console.log('✅ Carte du monde initialisée avec succès');
      } else {
        console.log(`✅ ${islandCount.count} îles déjà présentes, mise à jour des coordonnées...`);
        // Mettre à jour les coordonnées des îles à chaque démarrage
        await updateIslandCoordinates();

        // Initialiser les utilisateurs existants qui n'ont pas encore leur île et Luffy
        await initializeExistingUsers();
      }
    } catch (worldMapError) {
      console.warn('⚠️ Erreur lors de l\'initialisation de la carte du monde:', worldMapError);
      console.warn('💡 Vous pouvez initialiser manuellement avec: npm run seed-world-map');
    }

    console.log('🎉 Application initialisée avec succès');
    return app;

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    throw error;
  }
};

// Fonction de fermeture propre
export const closeApp = async (): Promise<void> => {
  try {
    console.log('🔄 Fermeture de l\'application...');
    await Database.close();
    console.log('✅ Application fermée proprement');
  } catch (error) {
    console.error('❌ Erreur lors de la fermeture:', error);
    throw error;
  }
};

export default app;
