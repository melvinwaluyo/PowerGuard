import { Platform } from "react-native";

export default function InteractiveMap() {
  if (Platform.OS === "web") {
    // Web: Use react-leaflet
    const { MapContainer, Marker, Popup, TileLayer } = require("react-leaflet");
    const L = require("leaflet");
    require("leaflet/dist/leaflet.css");

    // Fix default marker icon for Leaflet
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
      iconUrl: require("leaflet/dist/images/marker-icon.png"),
      shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
    });

    const defaultPosition = [40.7128, -74.0060];
    const React = require("react");
    const { useState } = React;
    const [marker, setMarker] = useState(defaultPosition);

    return (
      <MapContainer
        center={marker}
        zoom={15}
        style={{ height: 180, width: "100%", borderRadius: 12 }}
        whenReady={(map: any) => {
          map.target.on("click", (e: any) => {
            setMarker([e.latlng.lat, e.latlng.lng]);
          });
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={marker}>
          <Popup>Home Location</Popup>
        </Marker>
      </MapContainer>
    );
  } else {
    // Mobile: Use react-native-maps
    const React = require("react");
    const { useState } = React;
    const MapView = require("react-native-maps").default;
    const { Marker } = require("react-native-maps");
    const defaultPosition = { latitude: 40.7128, longitude: -74.0060 };
    const [marker, setMarker] = useState(defaultPosition);

    return (
      <MapView
        style={{ height: 180, width: "100%", borderRadius: 12 }}
        initialRegion={{
          ...defaultPosition,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={(e: any) => {
          setMarker(e.nativeEvent.coordinate);
        }}
      >
        <Marker coordinate={marker} />
      </MapView>
    );
  }
}