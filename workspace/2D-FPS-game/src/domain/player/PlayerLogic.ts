export interface MovementInput {
  x: number;
  y: number;
  sprint: boolean;
}

export interface PlayerState {
  readonly maxHealth: number;
  health: number;
  positionX: number;
  positionY: number;
  aimAngleRadians: number;
  isSprinting: boolean;
  lastAppliedSpeed: number;
  stunUntilMs: number;
}

export interface MovementConfig {
  readonly movementSpeed: number;
  readonly dashMultiplier: number;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

export class PlayerLogic {
  public readonly state: PlayerState;
  private readonly config: MovementConfig;

  public constructor(maxHealth: number, config: MovementConfig) {
    this.state = {
      maxHealth,
      health: maxHealth,
      positionX: 0,
      positionY: 0,
      aimAngleRadians: 0,
      isSprinting: false,
      lastAppliedSpeed: 0,
      stunUntilMs: 0
    };
    this.config = config;
  }

  public move(input: MovementInput, deltaSeconds: number, atTimeMs = 0, envMovementMultiplier = 1): void {
    if (this.isDead() || this.isStunned(atTimeMs)) {
      this.state.isSprinting = false;
      this.state.lastAppliedSpeed = 0;
      return;
    }

    const distance = Math.hypot(input.x, input.y);
    this.state.isSprinting = input.sprint && distance > 0;

    if (distance === 0) {
      this.state.lastAppliedSpeed = 0;
      return;
    }

    const speedMultiplier = this.state.isSprinting ? this.config.dashMultiplier : 1;
    const normalizedX = input.x / distance;
    const normalizedY = input.y / distance;
    const appliedSpeed = this.config.movementSpeed * speedMultiplier * envMovementMultiplier * deltaSeconds;

    this.state.lastAppliedSpeed = this.config.movementSpeed * speedMultiplier * envMovementMultiplier;
    this.state.positionX += normalizedX * appliedSpeed;
    this.state.positionY += normalizedY * appliedSpeed;
  }

  public updateAim(targetX: number, targetY: number, atTimeMs = 0): void {
    if (this.isDead() || this.isStunned(atTimeMs)) {
      return;
    }

    this.state.aimAngleRadians = Math.atan2(targetY - this.state.positionY, targetX - this.state.positionX);
  }

  public takeDamage(amount: number, stunDurationMs = 0, atTimeMs = 0): void {
    this.state.health = clamp(this.state.health - amount, 0, this.state.maxHealth);

    if (this.state.health > 0) {
      this.state.stunUntilMs = Math.max(this.state.stunUntilMs, atTimeMs + Math.max(stunDurationMs, 0));
    }
  }

  public heal(amount: number): number {
    if (this.isDead()) {
      return 0;
    }

    const previousHealth = this.state.health;
    this.state.health = clamp(this.state.health + amount, 0, this.state.maxHealth);
    return this.state.health - previousHealth;
  }

  public reset(positionX = 0, positionY = 0): void {
    this.state.health = this.state.maxHealth;
    this.state.positionX = positionX;
    this.state.positionY = positionY;
    this.state.aimAngleRadians = 0;
    this.state.isSprinting = false;
    this.state.lastAppliedSpeed = 0;
    this.state.stunUntilMs = 0;
  }

  public isDead(): boolean {
    return this.state.health === 0;
  }

  public isStunned(atTimeMs: number): boolean {
    return !this.isDead() && this.state.stunUntilMs > atTimeMs;
  }
}
