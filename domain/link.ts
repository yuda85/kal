import { isValidDate, localDate, localTime } from './dates.ts';
import { computeRecipe, portion } from './recipe.ts';
import type { Ingredient, Recipe, RecipeYield, Workout } from './types.ts';

export const LINK_VERSION = 1;

export interface AddOp {
  op: 'add';
  id: string;
  date: string;
  time: string;
  name: string;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  recipeId?: string;
  qty?: number;
}

export interface RecipeOp {
  op: 'recipe';
  id: string;
  name: string;
  aliases: string[];
  ingredients: Ingredient[];
  yield: RecipeYield;
}

export interface WeightOp {
  op: 'weight';
  date: string;
  kg: number;
}

export interface ActivityOp {
  op: 'activity';
  date: string;
  steps?: number;
  workouts?: Workout[];
}

export type Op = AddOp | RecipeOp | WeightOp | ActivityOp;

export interface Payload {
  v: typeof LINK_VERSION;
  ops: Op[];
}

export class LinkError extends Error {
  override name = 'LinkError';
}

type Obj = Record<string, unknown>;
type Limit = readonly [number, number];

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

const LIMITS = {
  entryKcal: [0, 5000],
  macroG: [0, 500],
  kg: [30, 300],
  steps: [0, 100000],
  durationMin: [1, 600],
  workoutKcal: [0, 3000],
  grams: [0, 10000],
  per100Kcal: [0, 900],
  per100G: [0, 100],
  qty: [0.1, 5000],
  units: [1, 500],
  cookedGrams: [1, 20000],
} as const satisfies Record<string, Limit>;

const ID = /^[a-z0-9]{4,32}$/;
const SLUG = /^[a-z0-9-]{1,60}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- base64url ----------

export function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(encoded: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(encoded)) throw new LinkError('bad encoding');
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (encoded.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new LinkError('bad encoding');
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new LinkError('bad encoding');
  }
}

export function encodePayload(p: Payload): string {
  return toBase64Url(JSON.stringify(p));
}

export function decodePayload(encoded: string): Payload {
  const text = fromBase64Url(encoded);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new LinkError('bad json');
  }
  return validatePayload(raw);
}

export function buildUrl(baseUrl: string, p: Payload): string {
  return `${baseUrl}#p=${encodePayload(p)}`;
}

export function payloadParam(hash: string): string | null {
  const match = /^#?p=([A-Za-z0-9_-]+)$/.exec(hash);
  return match ? match[1] : null;
}

// ---------- validation ----------

function checkNumber(o: Obj, key: string, [min, max]: Limit, path: string, errors: string[], optional = false): void {
  const v = o[key];
  if (v === undefined && optional) return;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    errors.push(`${path}.${key} must be a number in ${min}-${max}`);
  }
}

function checkPattern(o: Obj, key: string, pattern: RegExp, path: string, errors: string[], optional = false): void {
  const v = o[key];
  if (v === undefined && optional) return;
  if (typeof v !== 'string' || !pattern.test(v)) errors.push(`${path}.${key} is invalid`);
}

function checkDate(o: Obj, key: string, path: string, errors: string[]): void {
  const v = o[key];
  if (typeof v !== 'string' || !isValidDate(v)) errors.push(`${path}.${key} must be a valid YYYY-MM-DD date`);
}

function checkName(o: Obj, key: string, path: string, errors: string[], maxLength = 100, optional = false): void {
  const v = o[key];
  if (v === undefined && optional) return;
  if (typeof v !== 'string' || v.trim().length === 0 || [...v].length > maxLength) {
    errors.push(`${path}.${key} must be a non-empty name up to ${maxLength} characters`);
  }
}

function checkWorkout(w: unknown, path: string, errors: string[]): void {
  if (!isObj(w)) {
    errors.push(`${path} must be an object`);
    return;
  }
  checkName(w, 'type', path, errors, 40);
  checkNumber(w, 'durationMin', LIMITS.durationMin, path, errors);
  checkNumber(w, 'kcal', LIMITS.workoutKcal, path, errors);
  checkNumber(w, 'steps', LIMITS.steps, path, errors, true);
}

function checkIngredient(i: unknown, path: string, errors: string[]): void {
  if (!isObj(i)) {
    errors.push(`${path} must be an object`);
    return;
  }
  checkName(i, 'name', path, errors);
  checkNumber(i, 'grams', LIMITS.grams, path, errors);
  if (!isObj(i.per100)) {
    errors.push(`${path}.per100 must be an object`);
    return;
  }
  checkNumber(i.per100, 'kcal', LIMITS.per100Kcal, `${path}.per100`, errors);
  for (const k of ['protein', 'carbs', 'fat']) checkNumber(i.per100, k, LIMITS.per100G, `${path}.per100`, errors);
}

function checkYield(y: unknown, path: string, errors: string[]): void {
  if (!isObj(y)) {
    errors.push(`${path} must be an object`);
    return;
  }
  checkNumber(y, 'units', LIMITS.units, path, errors, true);
  checkNumber(y, 'cookedGrams', LIMITS.cookedGrams, path, errors, true);
  checkName(y, 'unitName', path, errors, 30, true);
  if (y.units === undefined && y.cookedGrams === undefined) errors.push(`${path} needs units or cookedGrams`);
}

function checkOp(op: unknown, path: string, errors: string[]): void {
  if (!isObj(op)) {
    errors.push(`${path} must be an object`);
    return;
  }
  switch (op.op) {
    case 'add':
      checkPattern(op, 'id', ID, path, errors);
      checkDate(op, 'date', path, errors);
      checkPattern(op, 'time', TIME, path, errors);
      checkName(op, 'name', path, errors);
      checkNumber(op, 'kcal', LIMITS.entryKcal, path, errors);
      for (const k of ['protein', 'carbs', 'fat']) checkNumber(op, k, LIMITS.macroG, path, errors, true);
      checkPattern(op, 'recipeId', SLUG, path, errors, true);
      checkNumber(op, 'qty', LIMITS.qty, path, errors, true);
      break;
    case 'recipe':
      checkPattern(op, 'id', SLUG, path, errors);
      checkName(op, 'name', path, errors);
      if (
        !Array.isArray(op.aliases) ||
        op.aliases.length > 10 ||
        !op.aliases.every((a) => typeof a === 'string' && a.trim().length > 0 && [...a].length <= 60)
      ) {
        errors.push(`${path}.aliases must be up to 10 non-empty strings`);
      }
      if (!Array.isArray(op.ingredients) || op.ingredients.length < 1 || op.ingredients.length > 40) {
        errors.push(`${path}.ingredients must have 1-40 items`);
      } else {
        op.ingredients.forEach((i, j) => checkIngredient(i, `${path}.ingredients[${j}]`, errors));
      }
      checkYield(op.yield, `${path}.yield`, errors);
      break;
    case 'weight':
      checkDate(op, 'date', path, errors);
      checkNumber(op, 'kg', LIMITS.kg, path, errors);
      break;
    case 'activity':
      checkDate(op, 'date', path, errors);
      checkNumber(op, 'steps', LIMITS.steps, path, errors, true);
      if (op.workouts !== undefined) {
        if (!Array.isArray(op.workouts) || op.workouts.length > 20) errors.push(`${path}.workouts must have up to 20 items`);
        else op.workouts.forEach((w, j) => checkWorkout(w, `${path}.workouts[${j}]`, errors));
      }
      if (op.steps === undefined && op.workouts === undefined) errors.push(`${path} needs steps or workouts`);
      break;
    default:
      errors.push(`${path}.op is unknown: ${String(op.op)}`);
  }
}

export function validatePayload(raw: unknown): Payload {
  if (!isObj(raw)) throw new LinkError('payload must be an object');
  if (raw.v !== LINK_VERSION) throw new LinkError(`unsupported version: ${String(raw.v)}`);
  if (!Array.isArray(raw.ops) || raw.ops.length < 1 || raw.ops.length > 30) {
    throw new LinkError('ops must be an array of 1-30 items');
  }
  const errors: string[] = [];
  raw.ops.forEach((op, i) => checkOp(op, `ops[${i}]`, errors));
  if (errors.length > 0) throw new LinkError(errors.join('; '));
  return raw as unknown as Payload;
}

// ---------- defaults ----------

export function newLinkId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

export function fillDefaults(draft: unknown, now: Date, newId: () => string): unknown {
  if (!isObj(draft) || !Array.isArray(draft.ops)) throw new LinkError('draft must be {"ops": [...]}');
  const date = localDate(now);
  const time = localTime(now);
  return {
    v: LINK_VERSION,
    ops: draft.ops.map((op) => {
      if (!isObj(op)) return op;
      if (op.op === 'add') return { id: newId(), date, time, ...op };
      if (op.op === 'weight' || op.op === 'activity') return { date, ...op };
      return op;
    }),
  };
}

// ---------- recipe portions ----------

function opsOf(payload: unknown): unknown[] {
  return isObj(payload) && Array.isArray(payload.ops) ? payload.ops : [];
}

function needsNumbers(op: unknown): op is Obj & { recipeId: string } {
  return isObj(op) && op.op === 'add' && typeof op.recipeId === 'string' && op.kcal === undefined;
}

export function recipesInPayload(payload: unknown): Recipe[] {
  return opsOf(payload)
    .filter((op): op is Obj => isObj(op) && op.op === 'recipe')
    .map((op) => ({
      id: String(op.id),
      name: String(op.name),
      aliases: Array.isArray(op.aliases) ? op.aliases.map(String) : [],
      ingredients: (op.ingredients ?? []) as Ingredient[],
      yield: (op.yield ?? {}) as RecipeYield,
    }));
}

export function pendingRecipeIds(payload: unknown): string[] {
  return opsOf(payload).filter(needsNumbers).map((op) => op.recipeId);
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

export function resolveRecipePortions(payload: unknown, recipes: Recipe[]): unknown {
  if (!isObj(payload) || !Array.isArray(payload.ops)) return payload;
  return {
    ...payload,
    ops: payload.ops.map((op) => {
      if (!needsNumbers(op)) return op;
      const recipe = recipes.find((r) => r.id === op.recipeId);
      if (!recipe) throw new LinkError(`unknown recipe: ${op.recipeId}`);
      if (typeof op.qty !== 'number') throw new LinkError(`add with recipeId ${op.recipeId} needs qty`);
      let numbers: ReturnType<typeof portion>;
      try {
        numbers = portion(computeRecipe(recipe.ingredients, recipe.yield), op.qty);
      } catch (e) {
        throw new LinkError(`recipe ${recipe.id} is invalid: ${e instanceof Error ? e.message : String(e)}`);
      }
      return {
        ...op,
        kcal: Math.round(numbers.kcal),
        protein: round1(numbers.protein),
        carbs: round1(numbers.carbs),
        fat: round1(numbers.fat),
      };
    }),
  };
}
