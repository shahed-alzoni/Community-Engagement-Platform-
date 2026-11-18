import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const DAMASCUS_CENTER = { lat: 33.5138, lng: 36.2765 }
const DEFAULT_ZOOM = 12
const MAP_OPTIONS = {
  clickableIcons: false,
  fullscreenControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  zoomControl: true,
}

function GoogleComplaintMap({ latitude, longitude, onPick, readOnly = false, explore = false, directions = false }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'qarib-google-maps',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_KEY,
  })
  const mapRef = useRef(null)
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const markerPosition = useMemo(() => {
    if (latitude == null || longitude == null) return null
    const point = { lat: Number(latitude), lng: Number(longitude) }
    return Number.isFinite(point.lat) && Number.isFinite(point.lng) ? point : null
  }, [latitude, longitude])

  const onLoad = useCallback((map) => {
    mapRef.current = map
    map.setCenter(markerPosition || DAMASCUS_CENTER)
    map.setZoom(DEFAULT_ZOOM)
  }, [markerPosition])

  useEffect(() => {
    if (!mapRef.current || !markerPosition) return
    mapRef.current.panTo(markerPosition)
  }, [markerPosition])

  if (loadError) return <div className="complaint-map complaint-map--unavailable" role="alert">Google Maps could not load. Check the Maps JavaScript API key and try again.</div>
  if (!isLoaded) return <div className="complaint-map complaint-map--loading" aria-label="Loading map" />

  return <GoogleMap
    mapContainerClassName="complaint-map"
    center={markerPosition || DAMASCUS_CENTER}
    zoom={DEFAULT_ZOOM}
    options={{ ...MAP_OPTIONS, draggable: !readOnly || explore, gestureHandling: !readOnly || explore ? 'greedy' : 'cooperative' }}
    onLoad={onLoad}
    onUnmount={() => { mapRef.current = null }}
    onClick={(event) => {
      if (readOnly) {
        if (directions && markerPosition) setDirectionsOpen(true)
      } else if (event.latLng) {
        onPick?.(event.latLng.lat(), event.latLng.lng())
      }
    }}
  >{markerPosition ? <MarkerF position={markerPosition} onClick={directions ? () => setDirectionsOpen(true) : undefined} /> : null}
    {directions && directionsOpen && markerPosition ? <InfoWindowF position={markerPosition} onCloseClick={() => setDirectionsOpen(false)}><a className="complaint-directions-link" href={`https://www.google.com/maps/dir/?api=1&destination=${markerPosition.lat}%2C${markerPosition.lng}`} target="_blank" rel="noopener noreferrer">Get directions to complaint location</a></InfoWindowF> : null}
  </GoogleMap>
}

export function ComplaintMap(props) {
  if (!import.meta.env.VITE_GOOGLE_KEY) {
    return <div className="complaint-map complaint-map--unavailable" role="alert">Google Maps is not configured yet. Add VITE_GOOGLE_KEY to .env.local.</div>
  }
  return <GoogleComplaintMap {...props} />
}
