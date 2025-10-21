import { useState } from "react";
import { Alert, Platform, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";

interface MobileMapProps {
  location: { latitude: number; longitude: number } | null;
  onLocationChange: (location: { latitude: number; longitude: number }) => void;
  radius: number; // in meters
}

export function MobileMap({ location: propLocation, onLocationChange, radius }: MobileMapProps) {
  const router = useRouter();
  const [displayInfo, setDisplayInfo] = useState<{
    address: string;
    city: string;
  } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Use prop location, not internal state
  const location = propLocation;

  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const message = Platform.OS === 'web'
          ? 'Please enable location permissions in your browser settings. Make sure you\'re accessing via localhost.'
          : 'Please enable location permissions to use this feature.';
        Alert.alert('Permission Denied', message);
        setIsLoadingLocation(false);
        return;
      }

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Call parent callback with new location
      onLocationChange({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      // Reverse geocode to get address for display (not available on web in SDK 49+)
      if (Platform.OS === 'web') {
        // For web, just show coordinates
        setDisplayInfo({
          address: `Lat: ${position.coords.latitude.toFixed(6)}`,
          city: `Lng: ${position.coords.longitude.toFixed(6)}`,
        });
      } else {
        // For native, use reverse geocoding
        try {
          const [geocode] = await Location.reverseGeocodeAsync({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });

          setDisplayInfo({
            address: `${geocode.streetNumber || ''} ${geocode.street || 'Unknown Street'}`.trim(),
            city: `${geocode.city || ''}, ${geocode.region || ''}, ${geocode.postalCode || ''}`,
          });
        } catch (geocodeError) {
          // Fallback to coordinates if geocoding fails
          setDisplayInfo({
            address: `Lat: ${position.coords.latitude.toFixed(6)}`,
            city: `Lng: ${position.coords.longitude.toFixed(6)}`,
          });
        }
      }

      setIsLoadingLocation(false);
    } catch (error) {
      console.error('Error getting location:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const fullMessage = Platform.OS === 'web'
        ? `Failed to get location: ${errorMessage}\n\nTip: Access via http://localhost:8081 and allow location permissions.`
        : 'Failed to get your current location. Please try again.';
      Alert.alert('Error', fullMessage);
      setIsLoadingLocation(false);
    }
  };

  const handleMapPress = () => {
    // Navigate to manual pin location screen with current location and radius
    if (location) {
      router.push({
        pathname: "/pin-location",
        params: {
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          radius: radius.toString(),
        },
      });
    } else {
      router.push({
        pathname: "/pin-location",
        params: {
          radius: radius.toString(),
        },
      });
    }
  };

  if (!location) {
    return (
      <View className="h-[200px] w-full rounded-2xl bg-white items-center justify-center p-6 border border-[#E5E7EB]">
        <View className="items-center">
          <Text className="text-[#0F0E41] font-semibold text-base mb-2">
            Home Location
          </Text>
          <Text className="text-[#6B7280] text-sm text-center mb-6">
            No location selected. Tap 'Select Location' to set your home address.
          </Text>
          <TouchableOpacity
            className={`rounded-xl px-6 py-3.5 flex-row items-center ${
              isLoadingLocation ? "bg-[#9CA3AF]" : "bg-[#0F0E41]"
            }`}
            onPress={getCurrentLocation}
            disabled={isLoadingLocation}
          >
            <View className="w-5 h-5 rounded-full bg-white items-center justify-center mr-2">
              <Text className="text-[#0F0E41] text-xs">📍</Text>
            </View>
            <Text className="text-white font-semibold text-sm">
              {isLoadingLocation ? "Getting Location..." : "Get Current Location"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render map preview using Leaflet for web, static map for mobile
  if (Platform.OS === "web") {
    const { MapContainer, TileLayer, Marker, Circle } = require("react-leaflet");
    const L = require("leaflet");
    require("leaflet/dist/leaflet.css");

    // Fix default marker icon
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
      iconUrl: require("leaflet/dist/images/marker-icon.png"),
      shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
    });

    return (
      <View className="h-[280px] w-full rounded-2xl bg-white overflow-hidden border border-[#E5E7EB]">
        {/* Map Preview - Clickable */}
        <TouchableOpacity
          className="h-[160px] w-full relative"
          onPress={handleMapPress}
          activeOpacity={0.9}
        >
          <MapContainer
            center={[location.latitude, location.longitude]}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Circle
              center={[location.latitude, location.longitude]}
              radius={radius}
              pathOptions={{
                color: '#0F0E41',
                fillColor: '#0F0E41',
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
            <Marker position={[location.latitude, location.longitude]} />
          </MapContainer>

          {/* Tap to change overlay */}
          <View
            className="absolute bottom-3 right-3 bg-white/95 rounded-full px-3 py-1.5"
            style={{
              elevation: 5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4
            }}
          >
            <Text className="text-[#0F0E41] text-[10px] font-semibold">
              Tap to change
            </Text>
          </View>
        </TouchableOpacity>

        {/* Address Info */}
        <View className="flex-1 p-4">
          <View className="flex-row items-start mb-2">
            <View className="w-5 h-5 items-center justify-center mr-2 mt-0.5">
              <Text className="text-[#0F0E41] text-sm">📍</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[#0F0E41] font-semibold text-xs leading-4">
                {displayInfo?.address || 'Loading...'}
              </Text>
              <Text className="text-[#6B7280] text-xs mt-0.5">
                {displayInfo?.city || ''}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className={`rounded-xl py-2.5 flex-row items-center justify-center mt-2 ${
              isLoadingLocation ? "bg-[#9CA3AF]" : "bg-[#0F0E41]"
            }`}
            onPress={getCurrentLocation}
            disabled={isLoadingLocation}
          >
            <View className="w-4 h-4 items-center justify-center mr-1.5">
              <Text className="text-white text-xs">📍</Text>
            </View>
            <Text className="text-white font-semibold text-xs">
              {isLoadingLocation ? "Updating..." : "Update Location"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Mobile: Show actual map preview using WebView with Leaflet
  const mobileMapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false
        }).setView([${location.latitude}, ${location.longitude}], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Add circle to show geofence radius
        L.circle([${location.latitude}, ${location.longitude}], {
          color: '#0F0E41',
          fillColor: '#0F0E41',
          fillOpacity: 0.1,
          radius: ${radius},
          weight: 2
        }).addTo(map);

        var redIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        L.marker([${location.latitude}, ${location.longitude}], { icon: redIcon }).addTo(map);
      </script>
    </body>
    </html>
  `;

  return (
    <View className="h-[280px] w-full rounded-2xl bg-white overflow-hidden border border-[#E5E7EB]">
      {/* Map Preview - Clickable */}
      <TouchableOpacity
        className="h-[160px] w-full relative"
        onPress={handleMapPress}
        activeOpacity={0.9}
      >
        <WebView
          source={{ html: mobileMapHTML }}
          style={{ flex: 1 }}
          scrollEnabled={false}
          pointerEvents="none"
        />

        {/* Tap to change badge */}
        <View
          className="absolute bottom-3 right-3 bg-white/95 rounded-full px-3 py-1.5"
          style={{
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4
          }}
        >
          <Text className="text-[#0F0E41] text-[10px] font-semibold">
            Tap to change
          </Text>
        </View>
      </TouchableOpacity>

      {/* Address Info */}
      <View className="flex-1 p-4">
        <View className="flex-row items-start mb-2">
          <View className="w-5 h-5 items-center justify-center mr-2 mt-0.5">
            <Text className="text-[#0F0E41] text-sm">📍</Text>
          </View>
          <View className="flex-1">
            <Text className="text-[#0F0E41] font-semibold text-xs leading-4">
              {displayInfo?.address || 'Loading...'}
            </Text>
            <Text className="text-[#6B7280] text-xs mt-0.5">
              {displayInfo?.city || ''}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          className={`rounded-xl py-2.5 flex-row items-center justify-center mt-2 ${
            isLoadingLocation ? "bg-[#9CA3AF]" : "bg-[#0F0E41]"
          }`}
          onPress={getCurrentLocation}
          disabled={isLoadingLocation}
        >
          <View className="w-4 h-4 items-center justify-center mr-1.5">
            <Text className="text-white text-xs">📍</Text>
          </View>
          <Text className="text-white font-semibold text-xs">
            {isLoadingLocation ? "Updating..." : "Update Location"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
