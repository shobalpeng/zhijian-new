import { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

export interface MapDestination {
  id: string;
  name: string;
  city?: string;
  lat?: number;
  lng?: number;
  status: 'wishlist' | 'visited';
  tagline?: string;
  visited_at?: string;
}

interface TravelMapProps {
  destinations: MapDestination[];
  /** 点击标记时回调（打开详情） */
  onSelect?: (id: string) => void;
}

/** 已去过：实心圆点（玫红，与图例一致） */
const visitedIcon = L.divIcon({
  className: 'zj-map-marker',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:hsl(350,70%,65%);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/** 想去：虚线空心圆点 */
const wishlistIcon = L.divIcon({
  className: 'zj-map-marker',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:transparent;border:2px dashed hsl(350,70%,65%);opacity:0.75"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/** 视图切换时把地图移到对应中心 */
function MapController({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  return null;
}

/** 足迹地图：把去过/想去的地点标在地图上 */
export function TravelMap({ destinations, onSelect }: TravelMapProps) {
  const [mapType, setMapType] = useState<'china' | 'world'>('china');

  // 中国 / 世界两个视图的中心与缩放级别
  const centerLat = mapType === 'china' ? 35 : 20;
  const centerLng = mapType === 'china' ? 105 : 0;
  const zoom = mapType === 'china' ? 4 : 2;

  // 只有填了经纬度的才有意义
  const markers = useMemo(
    () => destinations.filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number'),
    [destinations],
  );

  const visitedCount = markers.filter((d) => d.status === 'visited').length;
  /** 有目的地但没填经纬度的数量（无法上图） */
  const noGeoCount = destinations.length - markers.length;

  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">足迹地图</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMapType('china')}
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
              mapType === 'china'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            中国
          </button>
          <button
            type="button"
            onClick={() => setMapType('world')}
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
              mapType === 'world'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            世界
          </button>
        </div>
      </div>

      {markers.length === 0 ? (
        <div className="flex h-[300px] flex-col items-center justify-center gap-1.5 rounded-xl bg-muted/40 px-6 text-center">
          <p className="text-sm text-muted-foreground">还没有标记在地图上的地点</p>
          <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground/80">
            新增目的地时，填写「城市」后点搜索按钮选择一个结果，就会自动定位并出现在这里
          </p>
        </div>
      ) : (
        <div className="h-[300px] w-full overflow-hidden rounded-xl">
          <MapContainer
            center={[centerLat, centerLng]}
            zoom={zoom}
            className="h-full w-full"
            scrollWheelZoom
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapController lat={centerLat} lng={centerLng} zoom={zoom} />

            {markers.map((d) => {
              const isVisited = d.status === 'visited';
              return (
                <Marker
                  key={d.id}
                  position={[d.lat as number, d.lng as number]}
                  icon={isVisited ? visitedIcon : wishlistIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-medium">{d.name}</p>
                      <p className={isVisited ? 'text-xs text-emerald-600' : 'text-xs text-blue-600'}>
                        {isVisited ? '已去过' : '想去'}
                      </p>
                      {d.tagline && <p className="mt-0.5 text-xs text-muted-foreground">{d.tagline}</p>}
                      {onSelect && (
                        <button
                          type="button"
                          onClick={() => onSelect(d.id)}
                          className="mt-1 text-xs text-primary hover:underline"
                        >
                          查看详情 →
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: 'hsl(350,70%,65%)' }}
          />
          已去过 {visitedCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ border: '2px dashed hsl(350,70%,65%)', opacity: 0.75 }}
          />
          想去 {markers.length - visitedCount}
        </span>
        {noGeoCount > 0 && (
          <span className="inline-flex items-center gap-1 opacity-80">
            <span className="inline-block h-3 w-3 rounded-full border border-dashed border-muted-foreground/50" />
            未定位 {noGeoCount}
          </span>
        )}
      </div>
    </div>
  );
}
