// Validation de ce qui part vers l'API Anthropic avec TA clé.
//
// Séparé du reste pour être testable seul : c'est la pièce qui décide ce
// qu'un invité peut faire de ta facture, et elle mérite d'être vérifiée
// sans déployer quoi que ce soit.
//
// Le principe : liste blanche stricte. Tout ce qui n'est pas explicitement
// autorisé est refusé, plutôt que de tenter de deviner ce qui serait
// dangereux — la liste des choses dangereuses n'est jamais complète.

export const MODELES_AUTORISES = ['claude-opus-5'];
export const MAX_TOKENS_PLAFOND = 4096;
export const MAX_IMAGES = 4;
export const MAX_OCTETS = 12 * 1024 * 1024; // ~12 Mo : 4 photos redimensionnées
const CLES_RACINE = ['model', 'max_tokens', 'output_config', 'messages'];
const CLES_OUTPUT = ['effort', 'format'];
const EFFORTS = ['low', 'medium', 'high'];

export type Verdict = { ok: true; body: unknown } | { ok: false; raison: string };

export function verifierRequete(brut: string): Verdict {
  if (brut.length > MAX_OCTETS) return { ok: false, raison: 'requête trop volumineuse' };

  let corps: Record<string, unknown>;
  try {
    corps = JSON.parse(brut);
  } catch {
    return { ok: false, raison: 'corps illisible' };
  }
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) {
    return { ok: false, raison: 'corps invalide' };
  }

  for (const cle of Object.keys(corps)) {
    if (!CLES_RACINE.includes(cle)) return { ok: false, raison: 'champ interdit : ' + cle };
  }

  // Le modèle est imposé : sinon un invité pourrait viser un modèle plus
  // cher, ou un que l'app ne sait pas lire.
  if (!MODELES_AUTORISES.includes(corps.model as string)) {
    return { ok: false, raison: 'modèle non autorisé' };
  }

  // Le plafond de sortie est ce qui borne le coût d'un appel isolé.
  const maxTokens = corps.max_tokens;
  if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) ||
      maxTokens < 1 || maxTokens > MAX_TOKENS_PLAFOND) {
    return { ok: false, raison: 'max_tokens hors bornes' };
  }

  const oc = corps.output_config;
  if (oc !== undefined) {
    if (!oc || typeof oc !== 'object' || Array.isArray(oc)) {
      return { ok: false, raison: 'output_config invalide' };
    }
    for (const cle of Object.keys(oc)) {
      if (!CLES_OUTPUT.includes(cle)) return { ok: false, raison: 'output_config.' + cle + ' interdit' };
    }
    const effort = (oc as Record<string, unknown>).effort;
    if (effort !== undefined && !EFFORTS.includes(effort as string)) {
      // xhigh et max coûtent nettement plus cher : hors de portée d'un invité
      return { ok: false, raison: 'effort non autorisé' };
    }
  }

  const messages = corps.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 8) {
    return { ok: false, raison: 'messages invalides' };
  }

  let images = 0;
  for (const m of messages) {
    if (!m || typeof m !== 'object') return { ok: false, raison: 'message invalide' };
    const msg = m as Record<string, unknown>;
    if (msg.role !== 'user' && msg.role !== 'assistant') {
      return { ok: false, raison: 'rôle invalide' };
    }
    if (typeof msg.content === 'string') continue;
    if (!Array.isArray(msg.content)) return { ok: false, raison: 'contenu invalide' };
    for (const b of msg.content) {
      if (!b || typeof b !== 'object') return { ok: false, raison: 'bloc invalide' };
      const bloc = b as Record<string, unknown>;
      if (bloc.type === 'text') {
        if (typeof bloc.text !== 'string') return { ok: false, raison: 'texte invalide' };
        continue;
      }
      if (bloc.type === 'image') {
        // Seules les images en base64 passent : une source par URL ferait
        // télécharger n'importe quoi par le serveur d'Anthropic.
        const src = bloc.source as Record<string, unknown> | undefined;
        if (!src || src.type !== 'base64' || typeof src.data !== 'string' ||
            typeof src.media_type !== 'string' || !String(src.media_type).startsWith('image/')) {
          return { ok: false, raison: 'image invalide' };
        }
        if (++images > MAX_IMAGES) return { ok: false, raison: 'trop d’images' };
        continue;
      }
      return { ok: false, raison: 'type de bloc interdit : ' + String(bloc.type) };
    }
  }

  return { ok: true, body: corps };
}
