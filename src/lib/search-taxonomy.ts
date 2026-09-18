// src/lib/search-taxonomy.ts

export const MULTILINGUAL_SEARCH_TAXONOMY: Record<string, string[]> = {
  Concerts: [
    "concert", "concerts", "live music", "band", "bands", "music", "musician", "gig", "gigs", "acoustic",
    "orchestra", "symphony", "choir", "recital", "rock", "jazz", "blues", "country music", "hip hop", "folk",
    "concierto", "conciertos", "musica en vivo", "música en vivo", "musica", "música", "banda", "bandas", "orquesta",
    "musique", "musique en direct", "groupe", "chanson", "spectacle musical",
    "konzert", "konzerte", "live-musik", "livemusik", "musikgruppe", "orchester",
    "concerto", "concerti", "musica dal vivo", "gruppo musicale",
    "show", "shows", "música ao vivo", "musica ao vivo"
  ],
  "Food Trucks": [
    "food truck", "food trucks", "street food", "food trailer", "food van", "mobile food", "food rodeo", "food rally", "taco truck",
    "camion de comida", "camión de comida", "camiones de comida", "comida callejera", "puesto de comida",
    "camion restaurant", "cuisine de rue",
    "imbisswagen", "essen auf radern",
    "furgoncino dello street food", "cibo da strada",
    "carrinho de lanche", "comida de rua"
  ],
  Festivals: [
    "festival", "festivals", "fest", "fair", "fairs", "carnival", "fiesta", "street fair", "block party", "celebration", "expo",
    "feria", "ferias", "carnaval", "fiesta patronal", "verbena",
    "fête", "kermesse",
    "volksfest", "kirmes", "jahrmarkt",
    "festa", "feste", "sagra", "sagre",
    "festa junina"
  ],
  Sports: [
    "sport", "sports", "game", "match", "race", "racing", "tournament", "5k", "marathon", "run", "soccer", "football",
    "baseball", "basketball", "nascar", "hockey", "tennis", "golf", "athletics", "boxing", "wrestling",
    "deporte", "deportes", "partido", "carrera", "torneo", "futbol", "fútbol", "beisbol", "baloncesto", "maraton", "maratón",
    "course", "tournoi",
    "wettkampf", "rennen", "fussball", "fußball", "turnier",
    "partita", "corsa", "calcio",
    "esporte", "esportes", "jogo", "corrida"
  ],
  "Yard / Garage Sales": [
    "yard sale", "yard sales", "garage sale", "garage sales", "estate sale", "estate sales", "rummage sale",
    "tag sale", "moving sale", "barn sale", "car boot", "auction", "flea market",
    "venta de garaje", "venta de patio", "subasta", "rastro", "mercadillo",
    "vide-grenier", "brocante", "vente de garage",
    "flohmarkt", "trodelmarkt", "haushaltsauflosung",
    "mercatino dell'usato", "asta",
    "bazar", "venda de garagem", "leilão"
  ],
  Kids: [
    "kid", "kids", "child", "children", "family", "toddler", "youth", "preschool", "storytime", "circus", "puppet", "bounce house",
    "niño", "niños", "niña", "niñas", "familia", "infantil", "títeres", "cuentacuentos",
    "enfant", "enfants", "famille", "marionnettes",
    "kinder", "familie", "puppentheater",
    "bambino", "bambini", "famiglia", "burattini",
    "criança", "crianças", "família", "fantoches"
  ],
  Holiday: [
    "holiday", "holidays", "christmas", "halloween", "thanksgiving", "easter", "4th of july", "independence day",
    "new year", "new years", "st patrick", "memorial day", "labor day", "fireworks",
    "navidad", "nochebuena", "año nuevo", "pascua", "semana santa", "dia de muertos", "fuegos artificiales",
    "noël", "nouvel an", "pâques", "feux d'artifice",
    "weihnachten", "silvester", "ostern", "feuerwerk",
    "natale", "capodanno", "fuochi d'artificio",
    "natal", "queima de fogos"
  ],
  Classes: [
    "class", "classes", "workshop", "workshops", "seminar", "training", "lesson", "lessons", "course", "courses", "masterclass",
    "clase", "clases", "taller", "talleres", "curso", "cursos", "capacitacion", "capacitación",
    "cours", "atelier", "ateliers", "formation",
    "kurs", "kurse", "schulung",
    "corso", "corsi", "lezione", "lezioni",
    "aula", "aulas", "oficina", "treinamento"
  ],
  Nightlife: [
    "nightlife", "dj", "club", "karaoke", "trivia", "pub", "bar", "cocktail", "dance party", "happy hour",
    "vida nocturna", "discoteca", "copas",
    "vie nocturne", "boîte de nuit",
    "nachtleben", "kneipe",
    "vita notturna", "serata",
    "balada"
  ],
  Comedy: [
    "comedy", "standup", "stand-up", "comedian", "improv", "open mic",
    "comedia", "monologo", "monólogo", "comediante",
    "comédie", "humour", "humoriste",
    "komödie", "kabarett",
    "comico",
    "comédia", "humor"
  ],
  Arts: [
    "art", "arts", "craft", "crafts", "painting", "gallery", "exhibit", "exhibition", "theater", "theatre", "sculpture", "museum",
    "arte", "artes", "pintura", "galeria", "galería", "exposicion", "exposición", "teatro", "museo",
    "peinture", "exposition", "théâtre", "musée",
    "kunst", "malerei", "ausstellung",
    "mostra",
    "artes plásticas"
  ]
};

export function resolveCategoriesFromKeywords(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matched = new Set<string>();

  for (const [category, keywords] of Object.entries(MULTILINGUAL_SEARCH_TAXONOMY)) {
    for (const kw of keywords) {
      if (q === kw || q.includes(kw) || kw.includes(q)) {
        matched.add(category);
        break;
      }
    }
  }

  return Array.from(matched);
}

export function isPureCategoryQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  for (const keywords of Object.values(MULTILINGUAL_SEARCH_TAXONOMY)) {
    if (keywords.some(kw => kw === q || kw + 's' === q || kw === q + 's')) {
      return true;
    }
  }
  return false;
}

const COMMON_STOPWORDS = new Set([
  "the", "and", "or", "in", "at", "of", "for", "with", "from", "by", "on", "to", "a", "an"
]);

export function extractSearchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && !COMMON_STOPWORDS.has(t));
}

