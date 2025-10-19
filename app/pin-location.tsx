import { useState, useRef } from "react";
import { Platform, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";

const BASE_TOP_PADDING = 16;

export default function PinLocationScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: 40.7128,
    longitude: -74.006,
    address: "",
    city: "",
  });
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  const topInset =
    (Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0) +
    BASE_TOP_PADDING;

  const handleLocationChange = async (lat: number, lng: number) => {
    setSelectedLocation(prev => ({ ...prev, latitude: lat, longitude: lng }));

    // Reverse geocode to get address (not available on web in SDK 49+)
    try {
      setIsLoadingAddress(true);

      if (Platform.OS === 'web') {
        // For web, just show coordinates
        setSelectedLocation({
          latitude: lat,
          longitude: lng,
          address: `Lat: ${lat.toFixed(6)}`,
          city: `Lng: ${lng.toFixed(6)}`,
        });
      } else {
        // For native, use reverse geocoding
        const [geocode] = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

        setSelectedLocation({
          latitude: lat,
          longitude: lng,
          address: `${geocode.streetNumber || ''} ${geocode.street || ''}`.trim() || 'Unknown Location',
          city: `${geocode.city || ''}, ${geocode.region || ''}`.trim(),
        });
      }

      setIsLoadingAddress(false);
    } catch (error) {
      console.error('Error geocoding:', error);
      setSelectedLocation(prev => ({
        ...prev,
        address: 'Unknown Location',
        city: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      }));
      setIsLoadingAddress(false);
    }
  };

  const handleSaveLocation = () => {
    // Save location logic here
    router.back();
  };

  const handleMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS === 'web') {
          alert('Location permission denied. Please enable location access in your browser settings.');
        }
        console.log('Location permission status:', status);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      handleLocationChange(position.coords.latitude, position.coords.longitude);

      // Update map position on mobile via WebView
      if (Platform.OS !== "web" && webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.map && window.marker) {
            window.map.setView([${position.coords.latitude}, ${position.coords.longitude}], 15);
            window.marker.setLatLng([${position.coords.latitude}, ${position.coords.longitude}]);
          }
        `);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      if (Platform.OS === 'web') {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to get location: ${errorMessage}\n\nMake sure you're accessing via localhost and have granted location permissions.`);
      }
    }
  };

  if (Platform.OS === "web") {
    // Web: Use react-leaflet for interactive map
    const { MapContainer, TileLayer, Marker, useMapEvents } = require("react-leaflet");
    const L = require("leaflet");
    require("leaflet/dist/leaflet.css");

    // Custom red marker icon
    const redIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    function LocationMarker() {
      useMapEvents({
        click(e: any) {
          handleLocationChange(e.latlng.lat, e.latlng.lng);
        },
      });

      return (
        <Marker
          position={[selectedLocation.latitude, selectedLocation.longitude]}
          icon={redIcon}
        />
      );
    }

    return (
      <View className="flex-1 bg-white">
        {/* Header */}
        <View
          className="bg-white px-4 flex-row items-center border-b border-[#E5E7EB]"
          style={{ paddingTop: topInset, paddingBottom: 16 }}
        >
          <TouchableOpacity
            className="w-10 h-10 items-center justify-center"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#0F0E41" />
          </TouchableOpacity>
          <Text className="text-[#0F0E41] text-[18px] font-bold ml-3">
            Select Location
          </Text>
        </View>

        {/* Selected Location Info */}
        {selectedLocation.address && (
          <View className="mx-4 mt-4 mb-2 bg-[#E8F5F3] rounded-xl p-4">
            <Text className="text-[#0F0E41] font-semibold text-xs mb-1">
              Selected Location
            </Text>
            <Text className="text-[#374151] text-sm font-medium">
              {isLoadingAddress ? "Loading address..." : selectedLocation.address}
            </Text>
            {selectedLocation.city && (
              <Text className="text-[#6B7280] text-xs mt-1">
                {selectedLocation.city}
              </Text>
            )}
          </View>
        )}

        {/* Map */}
        <View className="flex-1 relative">
          <MapContainer
            center={[selectedLocation.latitude, selectedLocation.longitude]}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker />
          </MapContainer>

          {/* My Location Button */}
          <TouchableOpacity
            className="absolute bottom-4 right-4 w-12 h-12 bg-[#0F0E41] rounded-full items-center justify-center"
            onPress={handleMyLocation}
            style={{
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8
            }}
          >
            <Ionicons name="locate" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Confirm Button */}
        <View className="p-4 bg-white border-t border-[#E5E7EB]">
          <TouchableOpacity
            className="bg-[#0F0E41] rounded-xl py-4 items-center"
            onPress={handleSaveLocation}
            style={{
              elevation: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4
            }}
          >
            <Text className="text-white font-bold text-base">
              Confirm Location
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Mobile: Use WebView with Leaflet for interactive map
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
        // Initialize map
        var map = L.map('map').setView([${selectedLocation.latitude}, ${selectedLocation.longitude}], 15);
        window.map = map;

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Custom red marker icon
        var redIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        // Add marker
        var marker = L.marker([${selectedLocation.latitude}, ${selectedLocation.longitude}], { icon: redIcon }).addTo(map);
        window.marker = marker;

        // Handle map clicks
        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'locationChange',
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
          }));
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View
        className="bg-white px-4 flex-row items-center border-b border-[#E5E7EB]"
        style={{ paddingTop: topInset, paddingBottom: 16 }}
      >
        <TouchableOpacity
          className="w-10 h-10 items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#0F0E41" />
        </TouchableOpacity>
        <Text className="text-[#0F0E41] text-[18px] font-bold ml-3">
          Select Location
        </Text>
      </View>

      {/* Selected Location Info */}
      {selectedLocation.address && (
        <View className="mx-4 mt-4 mb-2 bg-[#E8F5F3] rounded-xl p-4">
          <Text className="text-[#0F0E41] font-semibold text-xs mb-1">
            Selected Location
          </Text>
          <Text className="text-[#374151] text-sm font-medium">
            {isLoadingAddress ? "Loading address..." : selectedLocation.address}
          </Text>
          {selectedLocation.city && (
            <Text className="text-[#6B7280] text-xs mt-1">
              {selectedLocation.city}
            </Text>
          )}
        </View>
      )}

      {/* Map */}
      <View className="flex-1 relative">
        <WebView
          ref={webViewRef}
          source={{ html: mobileMapHTML }}
          style={{ flex: 1 }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'locationChange') {
                handleLocationChange(data.latitude, data.longitude);
              }
            } catch (error) {
              console.error('Error parsing WebView message:', error);
            }
          }}
        />

        {/* My Location Button */}
        <TouchableOpacity
          className="absolute bottom-4 right-4 w-12 h-12 bg-[#0F0E41] rounded-full items-center justify-center"
          onPress={handleMyLocation}
          style={{
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8
          }}
        >
          <Ionicons name="locate" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Confirm Button */}
      <View className="p-4 bg-white border-t border-[#E5E7EB]">
        <TouchableOpacity
          className="bg-[#0F0E41] rounded-xl py-4 items-center"
          onPress={handleSaveLocation}
          style={{
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4
          }}
        >
          <Text className="text-white font-bold text-base">
            Confirm Location
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
