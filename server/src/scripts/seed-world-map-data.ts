import { Database } from '../utils/database.js';
import { WorldMapModel } from '../models/WorldMap.js';

/**
 * Script pour peupler les données initiales de la carte du monde One Piece
 * Basé sur le parcours de l'équipage du Chapeau de Paille
 */

interface IslandData {
  id: string;
  name: string;
  order_index: number;
  description: string;
  latitude: number;
  longitude: number;
  unlock_requirement_island_id: string | null;
  final_reward_type: 'berrys' | 'crew_member' | null;
  final_reward_value: number | null;
  final_reward_crew_member_id: string | null;
}

interface CrewMemberData {
  id: string;
  name: string;
  description: string;
  image_url: string;
  unlock_island_id: string | null;
  order_index: number;
}

interface QuestData {
  id: string;
  island_id: string;
  name: string;
  description: string;
  duration_hours: number;
  reward_berrys: number;
  required_crew_count: number;
  specific_crew_member_id: string | null;
  order_index: number;
  is_repeatable: boolean;
}

// Fonction pour mettre à jour uniquement les coordonnées des îles
async function updateIslandCoordinates() {
  console.log('📍 Mise à jour des coordonnées des îles...\n');

  const islandCoordinates = [
    { id: 'island_windmill_village', latitude: 12, longitude: 8 },
    { id: 'island_shells_town', latitude: 18, longitude: 15 },
    { id: 'island_orange_town', latitude: 25, longitude: 12 },
    { id: 'island_syrup_village', latitude: 32, longitude: 18 },
    { id: 'island_baratie', latitude: 38, longitude: 25 },
    { id: 'island_arlong_park', latitude: 45, longitude: 32 },
    { id: 'island_loguetown', latitude: 48, longitude: 42 },
    { id: 'island_drum', latitude: 42, longitude: 52 },
    { id: 'island_alabasta', latitude: 35, longitude: 58 },
    { id: 'island_water_seven', latitude: 28, longitude: 65 },
    { id: 'island_thriller_bark', latitude: 22, longitude: 75 },
    { id: 'island_sabaody', latitude: 15, longitude: 85 }
  ];

  for (const island of islandCoordinates) {
    await Database.run(`
      UPDATE islands
      SET latitude = ?, longitude = ?
      WHERE id = ?
    `, [island.latitude, island.longitude, island.id]);
  }

  console.log('✅ Coordonnées des îles mises à jour\n');
}

async function seedWorldMapData() {
  console.log('🏴‍☠️ Début du peuplement des données de la carte du monde...\n');

  try {
    // Vérifier si des données existent déjà
    const existingIslands = await Database.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM islands'
    );

    if (existingIslands && existingIslands.count > 0) {
      console.log('⚠️  Des données existent déjà. Voulez-vous les supprimer? (Ctrl+C pour annuler)');
      // En production, demander confirmation
      await Database.run('DELETE FROM quest_history');
      await Database.run('DELETE FROM active_quests');
      await Database.run('DELETE FROM user_islands');
      await Database.run('DELETE FROM user_crew_members');
      await Database.run('DELETE FROM quests');
      await Database.run('DELETE FROM crew_members');
      await Database.run('DELETE FROM islands');
      console.log('✅ Anciennes données supprimées\n');
    }

    // ===== MEMBRES D'ÉQUIPAGE =====
    const crewMembers: CrewMemberData[] = [
      {
        id: 'crew_luffy',
        name: 'Monkey D. Luffy',
        description: 'Le capitaine de l\'équipage, déterminé à devenir le Roi des Pirates',
        image_url: '/images/crew/luffy.png',
        unlock_island_id: null, // Débloqué dès le début
        order_index: 1
      },
      {
        id: 'crew_zoro',
        name: 'Roronoa Zoro',
        description: 'Le bretteur à trois sabres, premier membre de l\'équipage',
        image_url: '/images/crew/zoro.png',
        unlock_island_id: 'island_shells_town',
        order_index: 2
      },
      {
        id: 'crew_nami',
        name: 'Nami',
        description: 'La navigatrice experte, rêvant de cartographier le monde entier',
        image_url: '/images/crew/nami.png',
        unlock_island_id: 'island_orange_town',
        order_index: 3
      },
      {
        id: 'crew_usopp',
        name: 'Usopp',
        description: 'Le tireur d\'élite et conteur d\'histoires',
        image_url: '/images/crew/usopp.png',
        unlock_island_id: 'island_syrup_village',
        order_index: 4
      },
      {
        id: 'crew_sanji',
        name: 'Sanji',
        description: 'Le cuisinier aux jambes foudroyantes',
        image_url: '/images/crew/sanji.png',
        unlock_island_id: 'island_baratie',
        order_index: 5
      },
      {
        id: 'crew_chopper',
        name: 'Tony Tony Chopper',
        description: 'Le médecin du navire, un renne qui a mangé le fruit du Humain',
        image_url: '/images/crew/chopper.png',
        unlock_island_id: 'island_drum',
        order_index: 6
      },
      {
        id: 'crew_robin',
        name: 'Nico Robin',
        description: 'L\'archéologue recherchant le Rio Ponéglyphe',
        image_url: '/images/crew/robin.png',
        unlock_island_id: 'island_alabasta',
        order_index: 7
      },
      {
        id: 'crew_franky',
        name: 'Franky',
        description: 'Le charpentier cyborg, constructeur du Thousand Sunny',
        image_url: '/images/crew/franky.png',
        unlock_island_id: 'island_water_seven',
        order_index: 8
      },
      {
        id: 'crew_brook',
        name: 'Brook',
        description: 'Le musicien squelette aux pouvoirs du fruit de la Résurrection',
        image_url: '/images/crew/brook.png',
        unlock_island_id: 'island_thriller_bark',
        order_index: 9
      }
    ];

    console.log('📝 Insertion des membres d\'équipage (étape 1/2 - sans unlock_island_id)...');
    for (const member of crewMembers) {
      await Database.run(`
        INSERT INTO crew_members (id, name, description, image_url, unlock_island_id, order_index, is_active)
        VALUES (?, ?, ?, ?, NULL, ?, 1)
      `, [member.id, member.name, member.description, member.image_url, member.order_index]);
    }
    console.log(`✅ ${crewMembers.length} membres d\'équipage insérés (sans unlock_island_id)\n`);

    // ===== ÎLES =====
    const islands: IslandData[] = [
      {
        id: 'island_windmill_village',
        name: 'Village de Fuchsia',
        order_index: 1,
        description: 'Le village natal de Luffy dans East Blue',
        latitude: 12,
        longitude: 8,
        unlock_requirement_island_id: null, // Première île, toujours débloquée
        final_reward_type: 'berrys',
        final_reward_value: 500,
        final_reward_crew_member_id: null
      },
      {
        id: 'island_shells_town',
        name: 'Shells Town',
        order_index: 2,
        description: 'La ville où Luffy rencontre Zoro pour la première fois',
        latitude: 18,
        longitude: 15,
        unlock_requirement_island_id: 'island_windmill_village',
        final_reward_type: 'crew_member',
        final_reward_value: null,
        final_reward_crew_member_id: 'crew_zoro'
      },
      {
        id: 'island_orange_town',
        name: 'Orange Town',
        order_index: 3,
        description: 'Village attaqué par le pirate Buggy le Clown',
        latitude: 25,
        longitude: 12,
        unlock_requirement_island_id: 'island_shells_town',
        final_reward_type: 'crew_member',
        final_reward_value: null,
        final_reward_crew_member_id: 'crew_nami'
      },
      {
        id: 'island_syrup_village',
        name: 'Village de Syrup',
        order_index: 4,
        description: 'Le village natal d\'Usopp',
        latitude: 32,
        longitude: 18,
        unlock_requirement_island_id: 'island_orange_town',
        final_reward_type: 'crew_member',
        final_reward_value: null,
        final_reward_crew_member_id: 'crew_usopp'
      },
      {
        id: 'island_baratie',
        name: 'Restaurant Baratie',
        order_index: 5,
        description: 'Le restaurant flottant où travaille Sanji',
        latitude: 38,
        longitude: 25,
        unlock_requirement_island_id: 'island_syrup_village',
        final_reward_type: 'crew_member',
        final_reward_value: null,
        final_reward_crew_member_id: 'crew_sanji'
      },
      {
        id: 'island_arlong_park',
        name: 'Parc Arlong',
        order_index: 6,
        description: 'Le territoire contrôlé par l\'homme-poisson Arlong',
        latitude: 45,
        longitude: 32,
        unlock_requirement_island_id: 'island_baratie',
        final_reward_type: 'berrys',
        final_reward_value: 2000,
        final_reward_crew_member_id: null
      },
      {
        id: 'island_loguetown',
        name: 'Loguetown',
        order_index: 7,
        description: 'La ville du commencement et de la fin, où le Roi des Pirates fut exécuté',
        latitude: 48,
        longitude: 42,
        unlock_requirement_island_id: 'island_arlong_park',
        final_reward_type: 'berrys',
        final_reward_value: 3000,
        final_reward_crew_member_id: null
      },
      {
        id: 'island_drum',
        name: 'Île de Drum',
        order_index: 8,
        description: 'L\'île hivernale où vit Chopper',
        latitude: 42,
        longitude: 52,
        unlock_requirement_island_id: 'island_loguetown',
        final_reward_type: 'crew_member',
        final_reward_value: null,
        final_reward_crew_member_id: 'crew_chopper'
      },
      {
        id: 'island_alabasta',
        name: 'Royaume d\'Alabasta',
        order_index: 9,
        description: 'Le royaume désertique menacé par Crocodile',
        latitude: 35,
        longitude: 58,
        unlock_requirement_island_id: 'island_drum',
        final_reward_type: 'crew_member',
        final_reward_value: null,
        final_reward_crew_member_id: 'crew_robin'
      },
      {
        id: 'island_water_seven',
        name: 'Water Seven',
        order_index: 10,
        description: 'La cité de l\'eau, capitale de la construction navale',
        latitude: 28,
        longitude: 65,
        unlock_requirement_island_id: 'island_alabasta',
        final_reward_type: 'crew_member',
        final_reward_value: null,
        final_reward_crew_member_id: 'crew_franky'
      },
      {
        id: 'island_thriller_bark',
        name: 'Thriller Bark',
        order_index: 11,
        description: 'Le navire-île fantôme de Gecko Moria',
        latitude: 22,
        longitude: 75,
        unlock_requirement_island_id: 'island_water_seven',
        final_reward_type: 'crew_member',
        final_reward_value: null,
        final_reward_crew_member_id: 'crew_brook'
      },
      {
        id: 'island_sabaody',
        name: 'Archipel Sabaody',
        order_index: 12,
        description: 'L\'archipel aux bulles, porte d\'entrée du Nouveau Monde',
        latitude: 15,
        longitude: 85,
        unlock_requirement_island_id: 'island_thriller_bark',
        final_reward_type: 'berrys',
        final_reward_value: 10000,
        final_reward_crew_member_id: null
      }
    ];

    console.log('🏝️  Insertion des îles...');
    for (const island of islands) {
      await Database.run(`
        INSERT INTO islands (
          id, name, order_index, description, latitude, longitude,
          unlock_requirement_island_id, final_reward_type, final_reward_value,
          final_reward_crew_member_id, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        island.id, island.name, island.order_index, island.description,
        island.latitude, island.longitude, island.unlock_requirement_island_id,
        island.final_reward_type, island.final_reward_value,
        island.final_reward_crew_member_id
      ]);
    }
    console.log(`✅ ${islands.length} îles insérées\n`);

    // Maintenant mettre à jour les crew members avec leurs unlock_island_id
    console.log('📝 Mise à jour des membres d\'équipage (étape 2/2 - unlock_island_id)...');
    for (const member of crewMembers) {
      if (member.unlock_island_id) {
        await Database.run(`
          UPDATE crew_members
          SET unlock_island_id = ?
          WHERE id = ?
        `, [member.unlock_island_id, member.id]);
      }
    }
    console.log(`✅ Membres d\'équipage mis à jour avec unlock_island_id\n`);

    // ===== QUÊTES =====
    const quests: QuestData[] = [
      // Village de Fuchsia
      { id: 'quest_fuchsia_1', island_id: 'island_windmill_village', name: 'Chercher de la viande', description: 'Luffy a toujours faim ! Trouvez de la viande pour le repas.', duration_hours: 1, reward_berrys: 50, required_crew_count: 1, specific_crew_member_id: 'crew_luffy', order_index: 1, is_repeatable: true },
      { id: 'quest_fuchsia_2', island_id: 'island_windmill_village', name: 'Entraînement au combat', description: 'S\'entraîner pour devenir plus fort !', duration_hours: 2, reward_berrys: 75, required_crew_count: 1, specific_crew_member_id: null, order_index: 2, is_repeatable: true },
      { id: 'quest_fuchsia_3', island_id: 'island_windmill_village', name: 'Explorer la montagne', description: 'Explorer Corvo Mountain pour trouver des trésors.', duration_hours: 3, reward_berrys: 100, required_crew_count: 1, specific_crew_member_id: null, order_index: 3, is_repeatable: true },

      // Shells Town
      { id: 'quest_shells_1', island_id: 'island_shells_town', name: 'Libérer Zoro', description: 'Aider Zoro à s\'échapper de la base marine.', duration_hours: 2, reward_berrys: 100, required_crew_count: 1, specific_crew_member_id: 'crew_luffy', order_index: 1, is_repeatable: true },
      { id: 'quest_shells_2', island_id: 'island_shells_town', name: 'Affronter le Capitaine Morgan', description: 'Combattre le capitaine corrompu de la Marine.', duration_hours: 3, reward_berrys: 150, required_crew_count: 2, specific_crew_member_id: null, order_index: 2, is_repeatable: true },
      { id: 'quest_shells_3', island_id: 'island_shells_town', name: 'Réparer le navire', description: 'Préparer le navire pour la prochaine aventure.', duration_hours: 4, reward_berrys: 200, required_crew_count: 1, specific_crew_member_id: null, order_index: 3, is_repeatable: true },

      // Orange Town
      { id: 'quest_orange_1', island_id: 'island_orange_town', name: 'Sauver les villageois', description: 'Protéger les habitants terrorisés par Buggy.', duration_hours: 2, reward_berrys: 125, required_crew_count: 1, specific_crew_member_id: null, order_index: 1, is_repeatable: true },
      { id: 'quest_orange_2', island_id: 'island_orange_town', name: 'Combattre Buggy', description: 'Affronter le pirate Buggy le Clown !', duration_hours: 3, reward_berrys: 175, required_crew_count: 2, specific_crew_member_id: 'crew_luffy', order_index: 2, is_repeatable: true },
      { id: 'quest_orange_3', island_id: 'island_orange_town', name: 'Récupérer la carte', description: 'Aider Nami à récupérer la carte de Grand Line.', duration_hours: 2, reward_berrys: 150, required_crew_count: 1, specific_crew_member_id: 'crew_nami', order_index: 3, is_repeatable: true },

      // Village de Syrup
      { id: 'quest_syrup_1', island_id: 'island_syrup_village', name: 'Patrouiller le village', description: 'Aider Usopp à protéger le village.', duration_hours: 2, reward_berrys: 150, required_crew_count: 1, specific_crew_member_id: 'crew_usopp', order_index: 1, is_repeatable: true },
      { id: 'quest_syrup_2', island_id: 'island_syrup_village', name: 'Déjouer le plan de Kuro', description: 'Empêcher le Capitaine Kuro de nuire.', duration_hours: 4, reward_berrys: 250, required_crew_count: 3, specific_crew_member_id: null, order_index: 2, is_repeatable: true },
      { id: 'quest_syrup_3', island_id: 'island_syrup_village', name: 'Obtenir le Going Merry', description: 'Recevoir le navire cadeau de Kaya.', duration_hours: 3, reward_berrys: 200, required_crew_count: 1, specific_crew_member_id: null, order_index: 3, is_repeatable: true },

      // Restaurant Baratie
      { id: 'quest_baratie_1', island_id: 'island_baratie', name: 'Servir au restaurant', description: 'Aider au service pendant le rush.', duration_hours: 2, reward_berrys: 175, required_crew_count: 1, specific_crew_member_id: 'crew_sanji', order_index: 1, is_repeatable: true },
      { id: 'quest_baratie_2', island_id: 'island_baratie', name: 'Défendre le Baratie', description: 'Protéger le restaurant de l\'attaque de Don Krieg.', duration_hours: 5, reward_berrys: 350, required_crew_count: 3, specific_crew_member_id: null, order_index: 2, is_repeatable: true },
      { id: 'quest_baratie_3', island_id: 'island_baratie', name: 'Duel avec Mihawk', description: 'Zoro affronte le plus grand bretteur du monde.', duration_hours: 4, reward_berrys: 300, required_crew_count: 1, specific_crew_member_id: 'crew_zoro', order_index: 3, is_repeatable: true },

      // Parc Arlong
      { id: 'quest_arlong_1', island_id: 'island_arlong_park', name: 'Libérer le village de Nami', description: 'Aider à libérer Cocoyasi du joug d\'Arlong.', duration_hours: 3, reward_berrys: 250, required_crew_count: 2, specific_crew_member_id: null, order_index: 1, is_repeatable: true },
      { id: 'quest_arlong_2', island_id: 'island_arlong_park', name: 'Détruire Arlong Park', description: 'Démolir le QG des hommes-poissons !', duration_hours: 5, reward_berrys: 400, required_crew_count: 4, specific_crew_member_id: 'crew_luffy', order_index: 2, is_repeatable: true },
      { id: 'quest_arlong_3', island_id: 'island_arlong_park', name: 'Vaincre Arlong', description: 'Le combat final contre Arlong !', duration_hours: 4, reward_berrys: 350, required_crew_count: 1, specific_crew_member_id: 'crew_luffy', order_index: 3, is_repeatable: true },

      // Loguetown
      { id: 'quest_logue_1', island_id: 'island_loguetown', name: 'Visiter la place de l\'exécution', description: 'Se recueillir là où Gold Roger fut exécuté.', duration_hours: 1, reward_berrys: 200, required_crew_count: 1, specific_crew_member_id: null, order_index: 1, is_repeatable: true },
      { id: 'quest_logue_2', island_id: 'island_loguetown', name: 'Acheter des provisions', description: 'Préparer le voyage vers Grand Line.', duration_hours: 3, reward_berrys: 300, required_crew_count: 2, specific_crew_member_id: null, order_index: 2, is_repeatable: true },
      { id: 'quest_logue_3', island_id: 'island_loguetown', name: 'Échapper à Smoker', description: 'Fuir le capitaine Smoker de la Marine !', duration_hours: 4, reward_berrys: 400, required_crew_count: 3, specific_crew_member_id: null, order_index: 3, is_repeatable: true },

      // Île de Drum
      { id: 'quest_drum_1', island_id: 'island_drum', name: 'Escalader la montagne', description: 'Gravir la montagne enneigée pour trouver un docteur.', duration_hours: 4, reward_berrys: 350, required_crew_count: 2, specific_crew_member_id: null, order_index: 1, is_repeatable: true },
      { id: 'quest_drum_2', island_id: 'island_drum', name: 'Combattre Wapol', description: 'Vaincre l\'ancien roi tyrannique !', duration_hours: 5, reward_berrys: 500, required_crew_count: 3, specific_crew_member_id: null, order_index: 2, is_repeatable: true },
      { id: 'quest_drum_3', island_id: 'island_drum', name: 'Soigner Nami', description: 'Trouver Kureha pour soigner Nami.', duration_hours: 3, reward_berrys: 400, required_crew_count: 1, specific_crew_member_id: null, order_index: 3, is_repeatable: true },

      // Alabasta
      { id: 'quest_alabasta_1', island_id: 'island_alabasta', name: 'Traverser le désert', description: 'Voyager à travers le désert brûlant vers Alubarna.', duration_hours: 5, reward_berrys: 500, required_crew_count: 3, specific_crew_member_id: null, order_index: 1, is_repeatable: true },
      { id: 'quest_alabasta_2', island_id: 'island_alabasta', name: 'Infiltrer la base de Baroque Works', description: 'S\'infiltrer dans le QG secret de Crocodile.', duration_hours: 6, reward_berrys: 600, required_crew_count: 4, specific_crew_member_id: null, order_index: 2, is_repeatable: true },
      { id: 'quest_alabasta_3', island_id: 'island_alabasta', name: 'Vaincre Crocodile', description: 'Le combat ultime contre le Shichibukai !', duration_hours: 6, reward_berrys: 700, required_crew_count: 1, specific_crew_member_id: 'crew_luffy', order_index: 3, is_repeatable: true },

      // Water Seven
      { id: 'quest_water7_1', island_id: 'island_water_seven', name: 'Chercher un charpentier', description: 'Trouver quelqu\'un pour réparer le Going Merry.', duration_hours: 3, reward_berrys: 450, required_crew_count: 2, specific_crew_member_id: null, order_index: 1, is_repeatable: true },
      { id: 'quest_water7_2', island_id: 'island_water_seven', name: 'Sauver Robin', description: 'Secourir Robin du CP9 !', duration_hours: 8, reward_berrys: 1000, required_crew_count: 5, specific_crew_member_id: null, order_index: 2, is_repeatable: true },
      { id: 'quest_water7_3', island_id: 'island_water_seven', name: 'Obtenir le Thousand Sunny', description: 'Recevoir le nouveau navire construit par Franky.', duration_hours: 6, reward_berrys: 800, required_crew_count: 2, specific_crew_member_id: null, order_index: 3, is_repeatable: true },

      // Thriller Bark
      { id: 'quest_thriller_1', island_id: 'island_thriller_bark', name: 'Explorer le navire fantôme', description: 'Investiguer l\'immense navire-île mystérieux.', duration_hours: 4, reward_berrys: 600, required_crew_count: 3, specific_crew_member_id: null, order_index: 1, is_repeatable: true },
      { id: 'quest_thriller_2', island_id: 'island_thriller_bark', name: 'Récupérer les ombres', description: 'Reprendre les ombres volées par Moria.', duration_hours: 6, reward_berrys: 800, required_crew_count: 5, specific_crew_member_id: null, order_index: 2, is_repeatable: true },
      { id: 'quest_thriller_3', island_id: 'island_thriller_bark', name: 'Vaincre Oz et Moria', description: 'Combat contre le zombie géant et Gecko Moria !', duration_hours: 8, reward_berrys: 1200, required_crew_count: 6, specific_crew_member_id: null, order_index: 3, is_repeatable: true },

      // Archipel Sabaody
      { id: 'quest_sabaody_1', island_id: 'island_sabaody', name: 'Explorer les îles à bulles', description: 'Découvrir les merveilles de l\'archipel.', duration_hours: 3, reward_berrys: 700, required_crew_count: 2, specific_crew_member_id: null, order_index: 1, is_repeatable: true },
      { id: 'quest_sabaody_2', island_id: 'island_sabaody', name: 'Échapper aux Pacifistas', description: 'Fuir les armes humaines de la Marine !', duration_hours: 6, reward_berrys: 1000, required_crew_count: 5, specific_crew_member_id: null, order_index: 2, is_repeatable: true },
      { id: 'quest_sabaody_3', island_id: 'island_sabaody', name: 'Se préparer au Nouveau Monde', description: 'S\'entraîner pour les défis à venir.', duration_hours: 10, reward_berrys: 1500, required_crew_count: 6, specific_crew_member_id: null, order_index: 3, is_repeatable: true }
    ];

    console.log('⚔️  Insertion des quêtes...');
    for (const quest of quests) {
      await Database.run(`
        INSERT INTO quests (
          id, island_id, name, description, duration_hours, reward_berrys,
          required_crew_count, specific_crew_member_id, order_index,
          is_repeatable, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        quest.id, quest.island_id, quest.name, quest.description,
        quest.duration_hours, quest.reward_berrys, quest.required_crew_count,
        quest.specific_crew_member_id, quest.order_index, quest.is_repeatable ? 1 : 0
      ]);
    }
    console.log(`✅ ${quests.length} quêtes insérées\n`);

    // ===== DÉBLOQUER LA PREMIÈRE ÎLE ET LUFFY POUR TOUS LES UTILISATEURS =====
    console.log('🎯 Déb oquage initial pour tous les utilisateurs...');

    const users = await Database.all<{ id: string }>('SELECT id FROM users WHERE is_active = 1');

    for (const user of users) {
      // Débloquer la première île (Village de Fuchsia)
      const hasFirstIsland = await Database.get(
        'SELECT id FROM user_islands WHERE user_id = ? AND island_id = ?',
        [user.id, 'island_windmill_village']
      );

      if (!hasFirstIsland) {
        await WorldMapModel.unlockIsland(user.id, 'island_windmill_village');
      }

      // Débloquer Luffy
      const hasLuffy = await Database.get(
        'SELECT id FROM user_crew_members WHERE user_id = ? AND crew_member_id = ?',
        [user.id, 'crew_luffy']
      );

      if (!hasLuffy) {
        await WorldMapModel.unlockCrewMember(user.id, 'crew_luffy');
      }
    }

    console.log(`✅ ${users.length} utilisateurs initialisés avec la première île et Luffy\n`);

    console.log('🎉 Peuplement de la carte du monde terminé avec succès !');
    console.log('\n📊 Résumé:');
    console.log(`   - ${crewMembers.length} membres d'équipage`);
    console.log(`   - ${islands.length} îles`);
    console.log(`   - ${quests.length} quêtes`);
    console.log(`   - ${users.length} utilisateurs initialisés`);

  } catch (error) {
    console.error('❌ Erreur lors du peuplement:', error);
    throw error;
  }
}

/**
 * Initialise uniquement les utilisateurs existants qui n'ont pas encore leur île et Luffy
 * Utile pour corriger les utilisateurs créés avant l'implémentation de l'auto-initialisation
 */
async function initializeExistingUsers() {
  try {
    console.log('👥 Initialisation des utilisateurs existants...');

    const users = await Database.all<{ id: string }>('SELECT id FROM users WHERE is_active = 1');

    let usersInitialized = 0;

    for (const user of users) {
      let userNeedsInit = false;

      // Vérifier si l'utilisateur a la première île
      const hasFirstIsland = await Database.get(
        'SELECT id FROM user_islands WHERE user_id = ? AND island_id = ?',
        [user.id, 'island_windmill_village']
      );

      if (!hasFirstIsland) {
        await WorldMapModel.unlockIsland(user.id, 'island_windmill_village');
        userNeedsInit = true;
      }

      // Vérifier si l'utilisateur a Luffy
      const hasLuffy = await Database.get(
        'SELECT id FROM user_crew_members WHERE user_id = ? AND crew_member_id = ?',
        [user.id, 'crew_luffy']
      );

      if (!hasLuffy) {
        await WorldMapModel.unlockCrewMember(user.id, 'crew_luffy');
        userNeedsInit = true;
      }

      if (userNeedsInit) {
        usersInitialized++;
      }
    }

    if (usersInitialized > 0) {
      console.log(`✅ ${usersInitialized} utilisateur(s) initialisé(s) avec la première île et Luffy`);
    } else {
      console.log('✅ Tous les utilisateurs sont déjà initialisés');
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des utilisateurs existants:', error);
    throw error;
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  seedWorldMapData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedWorldMapData, updateIslandCoordinates, initializeExistingUsers };
