import { Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(workerUrl)

const DAMASCUS_CENTER = [36.2913, 33.5102]
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/bright'

export default function ComplaintMapView({ latitude, longitude, onPick, readOnly = false, explore = false }) {
  const elementRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const onPickRef = useRef(onPick)

  useEffect(() => { onPickRef.current = onPick }, [onPick])

  useEffect(() => {
    const map = new Map({
      container: elementRef.current,
      style: MAP_STYLE,
      center: DAMASCUS_CENTER,
      zoom: 11,
      attributionControl: true,
      interactive: !readOnly || explore,
    })
    if (!readOnly || explore) map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    if (!readOnly) {
      map.on('click', ({ lngLat }) => {
        const point = [lngLat.lng, lngLat.lat]
        if (markerRef.current) markerRef.current.setLngLat(point)
        else markerRef.current = new Marker({ color: '#f4774e', scale: 1.2 }).setLngLat(point).addTo(map)
        onPickRef.current?.(lngLat.lat, lngLat.lng)
      })
    }
    mapRef.current = map
    return () => { markerRef.current?.remove(); markerRef.current = null; map.remove(); mapRef.current = null }
  }, [readOnly, explore])

  useEffect(() => {
    if (!mapRef.current || latitude == null || longitude == null) return
    const point = [Number(longitude), Number(latitude)]
    if (markerRef.current) markerRef.current.setLngLat(point)
    else markerRef.current = new Marker({ color: '#f4774e', scale: 1.2 }).setLngLat(point).addTo(mapRef.current)
    mapRef.current.easeTo({ center: point, zoom: Math.max(mapRef.current.getZoom(), 14), duration: readOnly ? 0 : 450 })
  }, [latitude, longitude, readOnly])

  return <div ref={elementRef} className="complaint-map" aria-label={readOnly ? 'Complaint location map' : 'Choose complaint location on map'} />
}
