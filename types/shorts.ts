export interface NarrationSegment {
  id: "hook" | "problem" | "point1" | "point2" | "point3" | "ingredients" | "cta";
  label: string;
  text: string;
  estimatedStartSec: number;
  estimatedEndSec: number;
  cameraSection: "top" | "problem" | "point1" | "point2" | "point3" | "bottom" | "full";
}
