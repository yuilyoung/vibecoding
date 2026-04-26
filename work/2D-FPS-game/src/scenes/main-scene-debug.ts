import { publishWeatherChanged } from "../ui/hud-events";
import { DebugController } from "./debug-controller";
import type { DebugControllerDeps } from "./debug-controller";

export interface CreateMainSceneDebugControllerOptions extends Omit<DebugControllerDeps, "publishWeatherChange"> {
  readonly getCurrentEffectiveWeather: () => DebugControllerDeps["getCurrentEffectiveWeather"] extends () => infer T ? T : never;
}

export function createMainSceneDebugController(options: CreateMainSceneDebugControllerOptions): DebugController {
  return new DebugController({
    ...options,
    publishWeatherChange: () => {
      const weather = options.getCurrentEffectiveWeather();
      publishWeatherChanged({
        type: weather.type,
        movementMultiplier: weather.movementMultiplier,
        visionRange: weather.visionRange,
        windStrengthMultiplier: weather.windStrengthMultiplier,
        minesDisabled: weather.minesDisabled
      });
    }
  });
}
