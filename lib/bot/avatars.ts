import type { AvatarDefinition } from "open-bot-avatar";

/**
 * The shapes a bot can have: our own avatar definitions for the open-bot-avatar
 * renderer (MIT, see README.md here). Each is one path in a 0 0 100 100 box,
 * wound clockwise, plus where the eyes sit. Rows store the id; an unknown id
 * falls back to the first shape. `avatars.test.ts` validates every shape.
 */
export const botShapes = [
  {
    version: 1,
    id: "blob",
    name: "Blob",
    body: {
      path: "M50 14C76 14 86 24 86 50C86 76 76 86 50 86C24 86 14 76 14 50C14 24 24 14 50 14Z",
    },
    eyes: { x: 50, y: 47, spacing: 18, scale: 1.3 },
  },
  {
    version: 1,
    id: "raven",
    name: "Raven",
    body: {
      path: "M42 12C58 12 70 22 73 36C75 46 74 54 78 62C82 70 82 80 78 88H18C14 88 12 85 12 80C12 56 16 38 24 26C29 18 35 12 42 12ZM62 30C74 27 85 33 91 44C92 46 91 48 89 47C81 46 72 50 64 58Z",
    },
    eyes: { x: 43, y: 40, spacing: 15, scale: 1.1 },
  },
  {
    version: 1,
    id: "drop",
    name: "Drop",
    body: {
      path: "M50 10C58 24 80 42 80 60C80 76 66 88 50 88C34 88 20 76 20 60C20 42 42 24 50 10Z",
    },
    eyes: { x: 50, y: 62, spacing: 16, scale: 1.1 },
  },
  {
    version: 1,
    id: "pebble",
    name: "Pebble",
    body: {
      path: "M30 18C46 12 70 14 82 26C92 38 90 62 80 74C68 88 42 90 26 80C12 70 10 46 16 32C19 25 24 20 30 18Z",
    },
    eyes: { x: 52, y: 48, spacing: 17, scale: 1.2 },
  },
  {
    version: 1,
    id: "bean",
    name: "Bean",
    body: {
      path: "M34 16C50 12 60 24 72 26C86 28 92 44 88 60C84 78 66 88 48 86C28 84 12 70 12 50C12 32 20 20 34 16Z",
    },
    eyes: { x: 50, y: 52, spacing: 17, scale: 1.15 },
  },
  {
    version: 1,
    id: "cloud",
    name: "Cloud",
    body: {
      path: "M30 40C30 28 40 20 52 22C60 14 76 18 78 32C88 34 92 44 90 54C88 66 80 72 70 72H30C18 72 10 64 10 54C10 44 18 38 30 40Z",
    },
    eyes: { x: 52, y: 50, spacing: 16, scale: 1.0 },
  },
  {
    version: 1,
    id: "note",
    name: "Note",
    body: {
      path: "M26 12H62L80 30V82C80 86 77 88 74 88H26C23 88 20 86 20 82V18C20 14 22 12 26 12Z",
    },
    eyes: { x: 50, y: 54, spacing: 16, scale: 1.15 },
  },
  {
    version: 1,
    id: "magnifier",
    name: "Magnifier",
    body: {
      path: "M44 12A30 30 0 1 1 44 72A30 30 0 1 1 44 12ZM62 68L68 62L88 82C90 84 90 86 88 88C86 90 84 90 82 88Z",
    },
    eyes: { x: 44, y: 42, spacing: 16, scale: 1.15 },
  },
  {
    version: 1,
    id: "bulb",
    name: "Bulb",
    body: {
      path: "M50 10C68 10 80 23 80 40C80 52 72 58 66 64V72C66 76 63 78 60 78H40C37 78 34 76 34 72V64C28 58 20 52 20 40C20 23 32 10 50 10ZM40 82H60C62 82 63 83 63 85C63 87 62 88 60 88H40C38 88 37 87 37 85C37 83 38 82 40 82Z",
    },
    eyes: { x: 50, y: 40, spacing: 16, scale: 1.15 },
  },
  {
    version: 1,
    id: "leaf",
    name: "Leaf",
    body: {
      path: "M22 78C14 52 26 22 56 14C70 10 84 12 88 14C90 18 90 32 86 46C78 76 50 90 22 78Z",
    },
    eyes: { x: 56, y: 46, spacing: 16, scale: 1.1 },
  },
  {
    version: 1,
    id: "bear",
    name: "Bear",
    body: {
      path: "M50 22A32 32 0 1 1 50 86A32 32 0 1 1 50 22ZM26 15A9 9 0 1 1 26 33A9 9 0 1 1 26 15ZM74 15A9 9 0 1 1 74 33A9 9 0 1 1 74 15Z",
    },
    eyes: { x: 50, y: 56, spacing: 17, scale: 1.2 },
  },
  {
    version: 1,
    id: "mushroom",
    name: "Mushroom",
    body: {
      path: "M14 50C14 28 30 14 50 14C70 14 86 28 86 50C86 54 84 56 80 56H20C16 56 14 54 14 50ZM36 54H64V78C64 84 60 88 54 88H46C40 88 36 84 36 78Z",
    },
    eyes: { x: 50, y: 38, spacing: 18, scale: 1.0 },
  },
  {
    version: 1,
    id: "calendar",
    name: "Calendar",
    body: {
      path: "M26 22H74C80 22 84 26 84 32V78C84 84 80 88 74 88H26C20 88 16 84 16 78V32C16 26 20 22 26 22ZM32 8C34 8 36 10 36 12V28C36 30 34 32 32 32C30 32 28 30 28 28V12C28 10 30 8 32 8ZM68 8C70 8 72 10 72 12V28C72 30 70 32 68 32C66 32 64 30 64 28V12C64 10 66 8 68 8Z",
    },
    eyes: { x: 50, y: 56, spacing: 18, scale: 1.2 },
  },
  {
    version: 1,
    id: "pear",
    name: "Pear",
    body: {
      path: "M50 12C58 12 62 18 62 26C62 34 76 42 80 58C84 76 70 88 50 88C30 88 16 76 20 58C24 42 38 34 38 26C38 18 42 12 50 12Z",
    },
    eyes: { x: 50, y: 62, spacing: 16, scale: 1.1 },
  },
  {
    version: 1,
    id: "cat",
    name: "Cat",
    body: {
      path: "M20 30L24 12C25 9 27 9 29 11L40 22C46 21 54 21 60 22L71 11C73 9 75 9 76 12L80 30C86 38 88 48 88 56C88 76 72 88 50 88C28 88 12 76 12 56C12 48 14 38 20 30Z",
    },
    eyes: { x: 50, y: 54, spacing: 20, scale: 1.15 },
  },
  {
    version: 1,
    id: "owl",
    name: "Owl",
    body: {
      path: "M16 18C25 22 37 27 50 33C63 27 75 22 84 18C88 30 90 44 88 58C86 76 70 88 50 88C30 88 14 76 12 58C10 44 12 30 16 18Z",
    },
    eyes: { x: 50, y: 56, spacing: 22, scale: 1.3 },
  },
  {
    version: 1,
    id: "fox",
    name: "Fox",
    body: {
      path: "M14 14C14 11 17 10 19 12L36 26C44 23 56 23 64 26L81 12C83 10 86 11 86 14L84 40C84 62 68 80 50 88C32 80 16 62 16 40Z",
    },
    eyes: { x: 50, y: 46, spacing: 20, scale: 1.0 },
  },
  {
    version: 1,
    id: "bunny",
    name: "Bunny",
    body: {
      path: "M32 6C37 6 40 10 40 18V46H24V18C24 10 27 6 32 6ZM68 6C73 6 76 10 76 18V46H60V18C60 10 63 6 68 6ZM50 34C70 34 84 46 84 62C84 78 70 90 50 90C30 90 16 78 16 62C16 46 30 34 50 34Z",
    },
    eyes: { x: 50, y: 62, spacing: 18, scale: 1.1 },
  },
  {
    version: 1,
    id: "robot",
    name: "Robot",
    body: {
      path: "M24 28H76C82 28 86 32 86 38V76C86 82 82 86 76 86H24C18 86 14 82 14 76V38C14 32 18 28 24 28ZM48 14H52V30H48ZM50 8A6 6 0 1 1 50 20A6 6 0 1 1 50 8ZM8 48C8 46 9 45 11 45H16V69H11C9 69 8 68 8 66ZM84 45H89C91 45 92 46 92 48V66C92 68 91 69 89 69H84Z",
    },
    eyes: { x: 50, y: 56, spacing: 22, scale: 1.25 },
  },
  {
    version: 1,
    id: "star",
    name: "Star",
    body: {
      path: "M50.0 14.0L61.2 38.6L88.0 41.6L68.1 59.9L73.5 86.4L50.0 73.0L26.5 86.4L31.9 59.9L12.0 41.6L38.8 38.6Z",
    },
    eyes: { x: 50, y: 56, spacing: 12, scale: 0.85 },
  },
  {
    version: 1,
    id: "fish",
    name: "Fish",
    body: {
      path: "M10 50C16 34 34 24 52 24C66 24 74 34 76 42L88 30C90 28 92 29 92 32V68C92 71 90 72 88 70L76 58C74 66 66 76 52 76C34 76 16 66 10 50Z",
    },
    eyes: { x: 42, y: 48, spacing: 14, scale: 1.0 },
  },
  {
    version: 1,
    id: "heart",
    name: "Heart",
    body: {
      path: "M50 86C36 74 12 60 12 38C12 24 22 16 33 16C41 16 47 20 50 26C53 20 59 16 67 16C78 16 88 24 88 38C88 60 64 74 50 86Z",
    },
    eyes: { x: 50, y: 44, spacing: 18, scale: 1.1 },
  },
  {
    version: 1,
    id: "vault",
    name: "Vault",
    body: {
      path: "M20 14H80C85 14 88 17 88 22V76C88 81 85 84 80 84H76V88H66V84H34V88H24V84H20C15 84 12 81 12 76V22C12 17 15 14 20 14Z",
    },
    eyes: { x: 50, y: 48, spacing: 20, scale: 1.25 },
  },
] as const satisfies readonly AvatarDefinition[];

export type BotShape = (typeof botShapes)[number]["id"];

export const botShapeIds = botShapes.map((shape) => shape.id) as BotShape[];

export function botShape(id: string | undefined): AvatarDefinition {
  return botShapes.find((shape) => shape.id === id) ?? botShapes[0];
}
