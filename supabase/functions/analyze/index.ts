// ═══════════════════════════════════════════════════════════════════════
//  Proxy de lecture IA — fonction Edge Supabase
//
//  Sans elle, chaque personne doit créer un compte développeur chez
//  Anthropic, y mettre une carte, générer une clé et la coller dans
//  l'app. Personne ne le fera. Ici, la clé vit sur le serveur et ne
//  quitte jamais l'infrastructure.
//
//  En échange, c'est le propriétaire de l'app qui paie. Trois barrières,
//  dans cet ordre :
//    1. être connecté (jeton Supabase valide);
//    2. être sur la liste d'invités (table ai_allowlist);
//    3. ne pas avoir dépassé son plafond mensuel.
//
//  Déploiement :
//    supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
//    supabase functions deploy analyze
// ═══════════════════════════════════════════════════════════════════════
import { verifierRequete } from './guard.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

// L'app est servie depuis GitHub Pages : le navigateur exige un CORS
// explicite, y compris pour la requête préliminaire OPTIONS.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function refus(code: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), {
    status: code,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

/** Qui appelle ? On revalide le jeton auprès de Supabase plutôt que de
 *  décoder nous-mêmes : un JWT se fabrique, une vérification non. */
async function identifier(jeton: string): Promise<string | null> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jeton}`, apikey: SERVICE_KEY },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return typeof u?.id === 'string' ? u.id : null;
}

/** Compte l'appel et dit s'il est permis. Le comptage et la vérification
 *  du plafond se font côté base, dans une seule instruction. */
async function consommer(userId: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ai_consume`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ p_user: userId }),
  });
  if (!r.ok) return { allowed: false, used: 0, cap: 0 };
  const lignes = await r.json();
  return Array.isArray(lignes) && lignes[0] ? lignes[0] : { allowed: false, used: 0, cap: 0 };
}

async function noterJetons(userId: string, entree: number, sortie: number) {
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/ai_record_tokens`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ p_user: userId, p_in: entree, p_out: sortie }),
  }).catch(() => { /* la comptabilité ne doit pas faire échouer l'analyse */ });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return refus(405, 'méthode non autorisée');

  const entete = req.headers.get('authorization') || '';
  const jeton = entete.toLowerCase().startsWith('bearer ') ? entete.slice(7) : '';
  if (!jeton) return refus(401, 'connexion requise');

  const userId = await identifier(jeton);
  if (!userId) return refus(401, 'session invalide ou expirée');

  const brut = await req.text();
  const verdict = verifierRequete(brut);
  if (!verdict.ok) return refus(400, 'requête refusée : ' + verdict.raison);

  // 403 est le signal que l'app attend pour repasser à la clé personnelle
  const quota = await consommer(userId);
  if (!quota.allowed) {
    return refus(403, quota.cap > 0
      ? `plafond mensuel atteint (${quota.used}/${quota.cap}). Ajoute ta propre clé API pour continuer.`
      : 'ce compte n’est pas sur la liste des invités. Ajoute ta propre clé API pour utiliser la lecture IA.');
  }

  const reponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(verdict.body),
  });

  const texte = await reponse.text();
  if (reponse.ok) {
    try {
      const u = JSON.parse(texte)?.usage;
      if (u) await noterJetons(userId, Number(u.input_tokens) || 0, Number(u.output_tokens) || 0);
    } catch { /* réponse inattendue : rien à comptabiliser */ }
  }

  // La réponse d'Anthropic est renvoyée telle quelle : l'app sait déjà la
  // lire, y compris ses erreurs.
  return new Response(texte, {
    status: reponse.status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
});
