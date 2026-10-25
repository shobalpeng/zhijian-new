import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/components/auth-provider';
import { pb } from '@/lib/pocketbase';
import { FormPage, Field } from '@/components/common/form-page';
import { SingleImageField } from '@/components/common/single-image-field';
import { LoadingText } from '@/components/common/list-parts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { COLLECTION_ID, fileUrl } from '@/lib/format';

interface Destination {
  id: string;
  name: string;
  cover_image?: string;
  tagline?: string;
  status?: string;
  city?: string;
  lat?: number;
  lng?: number;
  places_to_visit?: string;
  itinerary_draft?: string;
  budget_estimate?: number;
  notes?: string;
}

interface GeoResult {
  name: string;
  lat: string;
  lng: string;
}

/** 添加 / 编辑目的地（对齐 V1 的 /travel/create，含城市搜索定位） */
export function DestinationFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [places, setPlaces] = useState('');
  const [itinerary, setItinerary] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('wishlist');

  const [file, setFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState('');
  const [clearImage, setClearImage] = useState(false);

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeoResult[]>([]);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const rec = await pb.collection('destinations').getOne<Destination>(id, {
          $autoCancel: false,
        });
        setName(rec.name ?? '');
        setTagline(rec.tagline ?? '');
        setCity(rec.city ?? '');
        setLat(rec.lat != null ? String(rec.lat) : '');
        setLng(rec.lng != null ? String(rec.lng) : '');
        setPlaces(rec.places_to_visit ?? '');
        setItinerary(rec.itinerary_draft ?? '');
        setBudget(rec.budget_estimate != null ? String(rec.budget_estimate) : '');
        setNotes(rec.notes ?? '');
        setStatus(rec.status || 'wishlist');
        if (rec.cover_image) {
          setExistingImage(fileUrl(COLLECTION_ID.destinations, rec.id, rec.cover_image, '300x0'));
        }
      } catch {
        toast.error('找不到这个目的地');
        navigate('/travel', { replace: true });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const searchCity = async () => {
    if (!city.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city.trim())}&format=json&limit=5&accept-language=zh`,
      );
      const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setResults(data.map((r) => ({ name: r.display_name, lat: r.lat, lng: r.lon })));
    } catch {
      setResults([]);
      toast.error('定位失败，可稍后手动填写');
    } finally {
      setSearching(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error('请输入目的地名');
      return;
    }
    const budgetNum = budget.trim() ? Number(budget) : null;
    if (budgetNum !== null && (!Number.isFinite(budgetNum) || budgetNum < 0)) {
      toast.error('预算需为不小于 0 的数字');
      return;
    }
    const latNum = lat.trim() ? Number(lat) : null;
    const lngNum = lng.trim() ? Number(lng) : null;
    if (
      (latNum !== null && !Number.isFinite(latNum)) ||
      (lngNum !== null && !Number.isFinite(lngNum))
    ) {
      toast.error('经纬度需为数字');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('status', status);
      fd.append('tagline', tagline.trim());
      fd.append('city', city.trim());
      if (latNum !== null) fd.append('lat', String(latNum));
      if (lngNum !== null) fd.append('lng', String(lngNum));
      fd.append('places_to_visit', places.trim());
      fd.append('itinerary_draft', itinerary.trim());
      if (budgetNum !== null) fd.append('budget_estimate', String(budgetNum));
      fd.append('notes', notes.trim());
      if (file) fd.append('cover_image', file);
      else if (clearImage) fd.append('cover_image', '');

      if (isEdit) {
        await pb.collection('destinations').update(id!, fd);
        toast.success('已保存');
      } else {
        if (user?.id) fd.append('creator', user.id);
        await pb.collection('destinations').create(fd);
        toast.success('已添加');
      }
      navigate('/travel', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingText />;

  return (
    <FormPage
      title={isEdit ? '编辑目的地' : '添加目的地'}
      onSubmit={submit}
      submitLabel={isEdit ? '保存修改' : '添加目的地'}
      disabled={!name.trim()}
      submitting={submitting}
      submittingLabel={isEdit ? '保存中…' : '添加中…'}
    >
      <Field label="目的地名 *" htmlFor="dest-name">
        <Input
          id="dest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：大理"
        />
      </Field>

      <Field label="封面图（可选）">
        <SingleImageField
          file={file}
          onChange={setFile}
          existingUrl={clearImage ? '' : existingImage}
          onClearExisting={() => {
            setExistingImage('');
            setClearImage(true);
          }}
        />
      </Field>

      <Field label="标语" htmlFor="dest-tagline">
        <Input
          id="dest-tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="如：风花雪月"
        />
      </Field>

      <Field label="城市（选填，输入后搜索定位）" htmlFor="dest-city">
        <div className="flex gap-2">
          <Input
            id="dest-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void searchCity();
              }
            }}
            placeholder="如：大理"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="搜索城市"
            onClick={() => void searchCity()}
            disabled={searching}
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
          </Button>
        </div>

        {results.length > 0 && (
          <div className="mt-2 max-h-40 divide-y overflow-y-auto rounded-xl border bg-card">
            {results.map((r) => (
              <button
                key={r.name + r.lat}
                type="button"
                onClick={() => {
                  setLat(r.lat);
                  setLng(r.lng);
                  setResults([]);
                }}
                className="w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
              >
                <p className="truncate">{r.name}</p>
                <p className="text-muted-foreground">
                  {r.lat}, {r.lng}
                </p>
              </button>
            ))}
          </div>
        )}
      </Field>

      {(lat || lng) && (
        <Field label="经纬度（已定位）">
          <div className="flex gap-2">
            <Input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="纬度"
              className="flex-1"
            />
            <Input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="经度"
              className="flex-1"
            />
          </div>
        </Field>
      )}

      <Field label="想去的地点（每行一个）" htmlFor="dest-places">
        <Textarea
          id="dest-places"
          value={places}
          onChange={(e) => setPlaces(e.target.value)}
          placeholder={'洱海\n古城\n苍山'}
          rows={3}
        />
      </Field>

      <Field label="行程草稿" htmlFor="dest-itinerary">
        <Textarea
          id="dest-itinerary"
          value={itinerary}
          onChange={(e) => setItinerary(e.target.value)}
          placeholder={'D1 抵达大理，古城漫步\nD2 环洱海骑行\nD3 苍山索道'}
          rows={4}
        />
      </Field>

      <Field label="预算估算（元）" htmlFor="dest-budget">
        <Input
          id="dest-budget"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="如：3000"
        />
      </Field>

      <Field label="备注" htmlFor="dest-notes">
        <Textarea
          id="dest-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </Field>
    </FormPage>
  );
}
