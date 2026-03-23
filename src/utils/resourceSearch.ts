import type { Resource } from '../types';

/** Extra tokens so common abbreviations match official facility names (e.g. LKH / UKH in AT/DE). */
const MEDICAL_SEARCH_ALIASES =
    'lkh ukh landeskrankenhaus universitätsklinikum universitatsklinikum krankenhaus hospital klinikum notaufnahme emergency ed er ambulance clinic';

const POLICE_ALIASES = 'police polizei station precinct';

const FIRE_ALIASES = 'fire feuerwehr station brigade rescue';

function typeAliases(r: Resource): string {
    if (r.type === 'medical') return MEDICAL_SEARCH_ALIASES;
    if (r.type === 'police') return POLICE_ALIASES;
    if (r.type === 'fire') return FIRE_ALIASES;
    return '';
}

export function buildResourceSearchHaystack(r: Resource, typeLabels: Record<Resource['type'], string>): string {
    const parts = [
        r.name,
        r.address,
        r.description,
        r.phone,
        r.operatingHours,
        r.notes,
        r.specialInstructions,
        r.contactPerson,
        r.contactPhone,
        r.type,
        typeLabels[r.type],
        typeAliases(r),
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Every significant word in the query must appear in the haystack (AND).
 * Words shorter than 2 characters are skipped.
 */
export function resourceMatchesSearchQuery(
    r: Resource,
    rawQuery: string,
    typeLabels: Record<Resource['type'], string>
): boolean {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return true;
    const haystack = buildResourceSearchHaystack(r, typeLabels);
    if (haystack.includes(q)) return true;
    const tokens = q.split(/\s+/).filter((w) => w.length >= 2);
    if (tokens.length === 0) return haystack.includes(q);
    return tokens.every((tok) => haystack.includes(tok));
}
