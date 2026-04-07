export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const intersectsRect = (left: Rect, right: Rect): boolean => {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
};

export const createCenteredRect = (
  centerX: number,
  centerY: number,
  width: number,
  height: number
): Rect => {
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height
  };
};
