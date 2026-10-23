import type { Scene } from "./scene";

/**
 * A small figure written for better-vault: a spring scale. It shows the model
 * the format and how parts meet, and the tests draw it.
 */
export const springScale: Scene = {
  title: "Spring scale",
  object:
    "A spring scale: a weight on the pan stretches the spring, and the needle turns by the same amount, so the dial reads the weight.",
  caption:
    "The heavier the load, the further the spring stretches; the stretch is what the dial reads.",
  camera: { azimuth: 45, elevation: 30 },
  assemblies: [
    { id: "base", name: "Base", explode: { x: 0, y: 0, z: 0 } },
    { id: "frame", name: "Frame", explode: { x: -24, y: 0, z: 10 } },
    { id: "hanging", name: "Spring and pan", explode: { x: 18, y: 0, z: 28 } },
    { id: "gauge", name: "Gauge", explode: { x: 0, y: 26, z: 16 } },
  ],
  parts: [
    {
      id: "base-plate",
      name: "Base plate",
      role: "base",
      assembly: "base",
      explanation: "A heavy plate that keeps the scale steady.",
      geometry: {
        kind: "box",
        x: -70,
        y: -45,
        z: 0,
        w: 140,
        d: 90,
        h: 10,
        corner: 5,
        details: ["groove", "screws"],
      },
    },
    {
      id: "column",
      name: "Column",
      role: "structure",
      assembly: "frame",
      explanation: "Holds the arm high above the base.",
      geometry: {
        kind: "box",
        x: -62,
        y: -8,
        z: 10,
        w: 12,
        d: 16,
        h: 90,
        corner: 1.5,
        details: ["seam"],
      },
    },
    {
      id: "arm",
      name: "Arm",
      role: "structure",
      assembly: "frame",
      explanation: "Reaches out over the pan and carries the spring.",
      geometry: {
        kind: "box",
        x: -62,
        y: -5,
        z: 100,
        w: 92,
        d: 10,
        h: 6,
        corner: 1.5,
        details: [],
      },
    },
    {
      id: "spring",
      name: "Spring",
      role: "mechanism",
      assembly: "hanging",
      explanation: "Stretches in proportion to the load hanging from it.",
      geometry: { kind: "spring", axis: "z", x: 20, y: 0, z: 62, length: 38, radius: 5, turns: 10 },
    },
    {
      id: "hanger",
      name: "Hanger",
      role: "mechanism",
      assembly: "hanging",
      explanation: "Joins the pan to the bottom of the spring.",
      geometry: { kind: "cylinder", x: 20, y: 0, z: 50, radius: 1.2, h: 12, details: [] },
    },
    {
      id: "pan",
      name: "Pan",
      role: "mechanism",
      assembly: "hanging",
      explanation: "Holds the load.",
      geometry: { kind: "cylinder", x: 20, y: 0, z: 46, radius: 24, h: 4, details: ["groove"] },
    },
    {
      id: "weight",
      name: "Weight",
      role: "subject",
      assembly: "hanging",
      explanation: "The load being measured.",
      geometry: { kind: "cylinder", x: 20, y: 0, z: 50, radius: 9, h: 12, details: ["knurl"] },
    },
    {
      id: "dial",
      name: "Dial",
      role: "structure",
      assembly: "gauge",
      explanation: "A scale of divisions the needle points at.",
      geometry: { kind: "cylinder", x: -20, y: 24, z: 10, radius: 14, h: 4, details: ["ruler"] },
    },
    {
      id: "needle",
      name: "Needle",
      role: "mechanism",
      assembly: "gauge",
      explanation: "Turns as the pan drops and points at the weight.",
      geometry: { kind: "needle", x: -20, y: 24, z: 14, length: 11, angle: 0 },
    },
  ],
  steps: [
    {
      title: "A light load",
      explanation: "The weight stretches the spring a little and the needle turns a little.",
      readout: "0.5 kg · stretch 4",
      focus: ["weight", "spring", "needle"],
      moves: [],
    },
    {
      title: "Twice the load",
      explanation:
        "Twice the weight stretches the spring twice as far: the pan drops 8 more and the needle turns a quarter turn.",
      readout: "1.0 kg · stretch 12",
      focus: ["weight", "spring", "needle"],
      moves: [
        { target: "spring", offset: { x: 0, y: 0, z: -8 }, turn: 0, stretch: 8 },
        { target: "hanger", offset: { x: 0, y: 0, z: -8 }, turn: 0, stretch: 0 },
        { target: "pan", offset: { x: 0, y: 0, z: -8 }, turn: 0, stretch: 0 },
        { target: "weight", offset: { x: 0, y: 0, z: -8 }, turn: 0, stretch: 0 },
        { target: "needle", offset: { x: 0, y: 0, z: 0 }, turn: 90, stretch: 0 },
      ],
    },
  ],
};
