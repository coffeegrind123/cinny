type MapLibreModule = typeof import('maplibre-gl');

let mapLibre: MapLibreModule | undefined;
let loading: Promise<MapLibreModule> | undefined;

/**
 * Loads MapLibre and its stylesheet on first use.
 *
 * Dynamic for the same reason KaTeX is, only more so: the library is roughly a
 * megabyte of JavaScript plus 84 kB of CSS, and maps are off by default. Nobody
 * who never opens a map should pay for it.
 */
export const loadMapLibre = async (): Promise<MapLibreModule> => {
  if (mapLibre) return mapLibre;
  if (!loading) {
    loading = (async () => {
      const [module] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ]);
      mapLibre = module;
      return module;
    })();
  }
  return loading;
};
