import { MobileMap } from "./MobileMap";

interface InteractiveMapProps {
  location: { latitude: number; longitude: number } | null;
  onLocationChange: (location: { latitude: number; longitude: number }) => void;
  radius: number;
}

export default function InteractiveMap({
  location,
  onLocationChange,
  radius,
}: InteractiveMapProps) {
  return (
    <MobileMap
      location={location}
      onLocationChange={onLocationChange}
      radius={radius}
    />
  );
}