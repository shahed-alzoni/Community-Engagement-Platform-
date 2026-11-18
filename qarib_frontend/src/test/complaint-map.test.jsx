import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { ComplaintMap } from '../components/complaints/ComplaintMap'

const map = vi.hoisted(() => ({
  panTo: vi.fn(),
  setCenter: vi.fn(),
  setZoom: vi.fn(),
}))

vi.mock('@react-google-maps/api', async () => {
  const { useEffect } = await import('react')
  return {
    useJsApiLoader: () => ({ isLoaded: true, loadError: null }),
    GoogleMap: ({ children, onClick, onLoad, options, zoom }) => {
      useEffect(() => { onLoad(map) }, [onLoad])
      return <><button type="button" data-testid="google-map" data-draggable={String(options.draggable)} data-zoom={zoom} onClick={() => onClick?.({ latLng: { lat: () => 34.8, lng: () => 37.2 } })}>Map</button>{children}</>
    },
    MarkerF: ({ position, onClick }) => <button type="button" data-testid="complaint-marker" onClick={onClick}>{position.lat}, {position.lng}</button>,
    InfoWindowF: ({ children }) => <div data-testid="directions-window">{children}</div>,
  }
})

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_KEY', 'test-key')
  vi.clearAllMocks()
})

afterEach(() => vi.unstubAllEnvs())

it('opens on Damascus at zoom 12 and updates a single marker without overriding manual zoom', () => {
  const onPick = vi.fn()
  const { rerender } = render(<ComplaintMap onPick={onPick} />)
  expect(map.setCenter).toHaveBeenCalledWith({ lat: 33.5138, lng: 36.2765 })
  expect(map.setZoom).toHaveBeenCalledWith(12)
  expect(screen.getByTestId('google-map')).toHaveAttribute('data-zoom', '12')
  expect(screen.getByTestId('google-map')).toHaveAttribute('data-draggable', 'true')
  expect(screen.queryByTestId('complaint-marker')).not.toBeInTheDocument()

  fireEvent.click(screen.getByTestId('google-map'))
  expect(onPick).toHaveBeenCalledWith(34.8, 37.2)
  rerender(<ComplaintMap latitude={34.8} longitude={37.2} onPick={onPick} />)
  expect(screen.getAllByTestId('complaint-marker')).toHaveLength(1)
  expect(screen.getByTestId('complaint-marker')).toHaveTextContent('34.8, 37.2')
  rerender(<ComplaintMap latitude={35.2} longitude={38.1} onPick={onPick} />)
  expect(screen.getAllByTestId('complaint-marker')).toHaveLength(1)
  expect(screen.getByTestId('complaint-marker')).toHaveTextContent('35.2, 38.1')
  expect(map.panTo).toHaveBeenCalledWith({ lat: 35.2, lng: 38.1 })
  expect(map.setZoom).toHaveBeenLastCalledWith(12)
})

it('shows the saved point without allowing citizens or representatives to change it', () => {
  const onPick = vi.fn()
  render(<ComplaintMap latitude="33.513800" longitude="36.276500" readOnly explore onPick={onPick} />)
  expect(map.setCenter).toHaveBeenCalledWith({ lat: 33.5138, lng: 36.2765 })
  expect(screen.getByTestId('complaint-marker')).toHaveTextContent('33.5138, 36.2765')
  fireEvent.click(screen.getByTestId('google-map'))
  expect(onPick).not.toHaveBeenCalled()
})

it('offers the representative directions to the saved complaint location', () => {
  render(<ComplaintMap latitude="33.513800" longitude="36.276500" readOnly explore directions />)
  fireEvent.click(screen.getByTestId('complaint-marker'))
  expect(screen.getByRole('link', { name: 'Get directions to complaint location' })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=33.5138%2C36.2765')
  expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
})

it('does not load Google Maps without a configured key', () => {
  vi.stubEnv('VITE_GOOGLE_KEY', '')
  render(<ComplaintMap />)
  expect(screen.getByRole('alert')).toHaveTextContent('VITE_GOOGLE_KEY')
})
