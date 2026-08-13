import Phaser from "phaser";

export interface MoveKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  sprint: Phaser.Input.Keyboard.Key;
  reload: Phaser.Input.Keyboard.Key;
  confirm: Phaser.Input.Keyboard.Key;
  fire: Phaser.Input.Keyboard.Key;
  swap: Phaser.Input.Keyboard.Key;
  weapon1: Phaser.Input.Keyboard.Key;
  weapon2: Phaser.Input.Keyboard.Key;
  weapon3: Phaser.Input.Keyboard.Key;
  weapon4: Phaser.Input.Keyboard.Key;
  weapon5: Phaser.Input.Keyboard.Key;
  weapon6: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
}

export interface InputBindings {
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  moveKeys: MoveKeys;
}

export function createInputBindings(scene: Phaser.Scene): InputBindings {
  if (scene.input.keyboard === null) {
    throw new Error("Keyboard input is unavailable in MainScene.");
  }

  const keyboard = scene.input.keyboard;
  return {
    cursors: keyboard.createCursorKeys(),
    moveKeys: {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      sprint: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      reload: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      confirm: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      fire: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      swap: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      weapon1: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      weapon2: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      weapon3: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      weapon4: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      weapon5: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
      weapon6: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SIX),
      interact: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    }
  };
}
