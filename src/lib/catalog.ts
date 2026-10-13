import { UserRound, Lightbulb, Sun, Package, Command } from 'lucide-react';

// Small built-in blockout catalog. Game asset mounting remains separate.
export const MATERIALS = [
  { name: 'Measure · cool', path: 'DEV/DEV_MEASUREGENERIC01B', color: '#8d9aaa' },
  { name: 'Measure · warm', path: 'DEV/DEV_MEASUREGENERIC01', color: '#b58a55' },
  { name: 'Nodraw', path: 'TOOLS/TOOLSNODRAW', color: '#666970' },
  { name: 'Player clip', path: 'TOOLS/TOOLSPLAYERCLIP', color: '#a1628c' },
  { name: 'Trigger', path: 'TOOLS/TOOLSTRIGGER', color: '#d39a55' },
  { name: 'Skybox', path: 'TOOLS/TOOLSSKYBOX', color: '#7ea6bb' }
];
export const ENTITIES = [
  { label: 'Player spawn', class: 'info_player_start', icon: UserRound, props: {} },
  { label: 'Point light', class: 'light', icon: Lightbulb, props: { _light: '255 238 210 500' } },
  { label: 'Environment light', class: 'light_environment', icon: Sun, props: { _light: '255 245 220 600', _ambient: '170 195 230 80' } },
  { label: 'Static prop', class: 'prop_static', icon: Package, props: { model: '' } },
  { label: 'Logic relay', class: 'logic_relay', icon: Command, props: { targetname: 'relay_01' } },
  { label: 'GMod spawn', class: 'info_player_deathmatch', icon: UserRound, props: {} }
];
