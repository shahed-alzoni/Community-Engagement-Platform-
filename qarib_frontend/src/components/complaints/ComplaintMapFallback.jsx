import L from 'leaflet'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

const DAMASCUS_CENTER = [33.5102, 36.2913]
const pinIcon = L.divIcon({
  className: 'complaint-pin-icon',
  html: '<span class="complaint-pin-shape"><span class="complaint-pin-center"></span></span>',
  iconSize: [36, 46],
  iconAnchor: [18, 43],
})

export default function ComplaintMapFallback({ latitude, longitude, onPick, readOnly = false, explore = false }) {
  const elementRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const onPickRef = useRef(onPick)

  useEffect(() => { onPickRef.current = onPick }, [onPick])

  useEffect(() => {
    const map = L.map(elementRef.current, { scrollWheelZoom: explore, zoomControl: !readOnly || explore, dragging: !readOnly || explore }).setView(DAMASCUS_CENTER, 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    if (!readOnly) map.on('click', ({ latlng }) => {
      if (markerRef.current) markerRef.current.setLatLng(latlng)
      else markerRef.current = L.marker(latlng, { icon: pinIcon }).addTo(map)
      onPickRef.current?.(latlng.lat, latlng.lng)
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, [readOnly, explore])

  useEffect(() => {
    if (!mapRef.current || latitude == null || longitude == null) return
    const point = [Number(latitude), Number(longitude)]
    if (markerRef.current) markerRef.current.setLatLng(point)
    else markerRef.current = L.marker(point, { icon: pinIcon }).addTo(mapRef.current)
    mapRef.current.setView(point, Math.max(mapRef.current.getZoom(), 14))
  }, [latitude, longitude])

  return <div ref={elementRef} className="complaint-map" aria-label={readOnly ? 'Complaint location map' : 'Choose complaint location on map'} />
}
