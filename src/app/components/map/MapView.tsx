import { useEffect, useRef, useState } from 'react';
import { Box, Spinner, Text, color, config } from 'folds';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { loadMapLibre } from '../../plugins/maplibre';

export type MapPin = {
  latitude: number;
  longitude: number;
  /** Drawn as a live-location pin rather than a static one. */
  live?: boolean;
  label?: string;
};

export type MapViewProps = {
  styleUrl: string;
  pins: MapPin[];
  /** Initial centre. Defaults to the first pin. */
  center?: { latitude: number; longitude: number };
  zoom?: number;
  interactive?: boolean;
  height?: string;
  /** Called with the clicked position when the map is used as a picker. */
  onPick?: (position: { latitude: number; longitude: number }) => void;
};

/**
 * A MapLibre map.
 *
 * Only rendered by callers that have already established both that the user
 * turned maps on and that a style URL exists — this component never decides
 * that for itself, because a map that renders as an empty grey rectangle is
 * worse than a link.
 */
export function MapView({
  styleUrl,
  pins,
  center,
  zoom = 14,
  interactive = true,
  height = '200px',
  onPick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | undefined>(undefined);
  const markersRef = useRef<Marker[]>([]);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return undefined;

    loadMapLibre()
      .then((maplibre) => {
        if (disposed || !containerRef.current) return;
        const first = center ?? pins[0];
        const map = new maplibre.Map({
          container: containerRef.current,
          style: styleUrl,
          center: first ? [first.longitude, first.latitude] : [0, 0],
          zoom,
          interactive,
          // The library's own attribution control is required by most tile
          // providers' terms — never turn it off.
          attributionControl: { compact: true },
        });
        map.on('error', () => setFailed(true));
        map.on('load', () => {
          if (!disposed) setReady(true);
        });
        if (onPick) {
          map.on('click', (evt) => {
            onPick({ latitude: evt.lngLat.lat, longitude: evt.lngLat.lng });
          });
        }
        mapRef.current = map;
      })
      .catch(() => setFailed(true));

    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = undefined;
    };
    // Rebuilding the map on every pin change would throw away the user's own
    // panning; pins are synced separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    loadMapLibre().then((maplibre) => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = pins.map((pin) => {
        const marker = new maplibre.Marker({
          color: pin.live ? color.Success.Main : color.Primary.Main,
        })
          .setLngLat([pin.longitude, pin.latitude])
          .addTo(map);
        return marker;
      });

      const first = center ?? pins[0];
      if (first) map.setCenter([first.longitude, first.latitude]);
    });
  }, [pins, center, ready]);

  if (failed) {
    return (
      <Box
        alignItems="Center"
        justifyContent="Center"
        style={{
          height,
          borderRadius: config.radii.R300,
          backgroundColor: color.SurfaceVariant.Container,
        }}
      >
        <Text size="T200" priority="300">
          The map could not be loaded.
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{ position: 'relative', height, width: '100%' }}>
      <div
        ref={containerRef}
        style={{
          height: '100%',
          width: '100%',
          borderRadius: config.radii.R300,
          overflow: 'hidden',
        }}
      />
      {!ready && (
        <Box
          alignItems="Center"
          justifyContent="Center"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: color.SurfaceVariant.Container,
            borderRadius: config.radii.R300,
          }}
        >
          <Spinner variant="Secondary" size="400" />
        </Box>
      )}
    </Box>
  );
}
