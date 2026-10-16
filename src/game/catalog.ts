import type { PassiveId, UpgradeId, UpgradeOffer, WeaponId } from "./types";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  blurb: string;
  loud: string;
  ambush: string;
};

export type PassiveDef = {
  id: PassiveId;
  name: string;
  blurb: string;
  detail: string;
};

export const WEAPONS: WeaponDef[] = [
  {
    id: "bren",
    name: "Akimbo CZ Bren 2",
    blurb: "Starter rifles",
    loud: "Bursts at the nearest invader.",
    ambush: "3s of piercing depleted-uranium fire.",
  },
  {
    id: "artillery",
    name: "800,000 Shells",
    blurb: "Czech artillery",
    loud: "A 155mm shell on a cluster every few seconds.",
    ambush: "Eight-shell ring on the washing machine.",
  },
  {
    id: "drone",
    name: "FPV Drone Swarm",
    blurb: "Kamikaze quads",
    loud: "A drone hunts the toughest target.",
    ambush: "Eight turbo drones dive the decoy pile.",
  },
  {
    id: "moto",
    name: "BMW R1250 GS",
    blurb: "Tactical motorcycle",
    loud: "A ghost bike mows a lane.",
    ambush: "Pavel rides through, invulnerable, leaving fire.",
  },
  {
    id: "mlrs",
    name: "RM-70 Vampire",
    blurb: "Rocket salvo",
    loud: "A horizontal rocket rake.",
    ambush: "Thermobaric flames around the decoy.",
  },
];

export const PASSIVES: PassiveDef[] = [
  {
    id: "lumberjack",
    name: "Lumberjack Physique",
    blurb: "+25% HP",
    detail: "Max HP up. Exiting stealth knocks the crowd back.",
  },
  {
    id: "pilsner",
    name: "Pilsner Hydration",
    blurb: "+1.5s battery",
    detail: "Bigger stealth battery and faster recharge.",
  },
  {
    id: "nafo",
    name: "NAFO Fella",
    blurb: "Tracksuit Shiba",
    detail: "A Shiba fetches tags in stealth and throws bricks.",
  },
];

const WEAPON_MAX = 5;
const PASSIVE_MAX = 3;

export function offerFor(id: UpgradeId, rank: number): UpgradeOffer {
  const weapon = WEAPONS.find((w) => w.id === id);
  if (weapon) {
    const isMax = rank === WEAPON_MAX;
    const rarity = isMax ? "legendary" : rank >= 3 ? "elite" : "tactical";
    const blurb = rank === 1 ? "★ NEW ARSENAL" : isMax ? "⚡ OVERCLOCKED MAX" : `RANK ${rank} UPGRADE`;
    const detail =
      rank === 1
        ? weapon.loud
        : isMax
          ? `MAX OVERDRIVE! Double fire rate, piercing uranium rounds, screen-shaking ambush explosions!`
          : `${weapon.ambush} +35% damage & faster volleys.`;

    return {
      id,
      kind: "weapon",
      name: isMax ? `★ ${weapon.name} MK.V` : weapon.name,
      blurb,
      detail,
      rank,
      maxRank: WEAPON_MAX,
      rarity,
    };
  }
  const passive = PASSIVES.find((p) => p.id === id);
  if (passive) {
    const isMax = rank === PASSIVE_MAX;
    const rarity = isMax ? "legendary" : rank >= 2 ? "elite" : "tactical";
    return {
      id,
      kind: "passive",
      name: isMax ? `★ ${passive.name} MAX` : passive.name,
      blurb: isMax ? "⚡ MAX EVOLUTION" : `TIER ${rank}`,
      detail: isMax ? `${passive.detail} Maximum battlefield dominance!` : passive.detail,
      rank,
      maxRank: PASSIVE_MAX,
      rarity,
    };
  }
  return {
    id: "bren",
    kind: "weapon",
    name: "Tactical Supply Crate",
    blurb: "EMERGENCY DROP",
    detail: "Restores HP and charges Flannel Overdrive instantly.",
    rank: 1,
    maxRank: 1,
    rarity: "tactical",
  };
}

export const WEAPON_MAX_RANK = WEAPON_MAX;
export const PASSIVE_MAX_RANK = PASSIVE_MAX;
