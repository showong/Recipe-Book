export interface NarrationSegment {
  id: "hook" | "problem" | "point1" | "point2" | "point3" | "ingredients" | "cta";
  label: string;
  text: string;
  estimatedStartSec: number;
  estimatedEndSec: number;
  cameraSection:
    | "cell_food"
    | "cell_problem"
    | "cell_point1"
    | "cell_point2"
    | "cell_point3"
    | "cell_ingredients"
    | "full";
}
