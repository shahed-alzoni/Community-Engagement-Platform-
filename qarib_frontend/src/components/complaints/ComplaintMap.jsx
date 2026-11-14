import { Component, lazy, Suspense } from 'react'

const ModernMap = lazy(() => import('./ComplaintMapView'))
const FallbackMap = lazy(() => import('./ComplaintMapFallback'))
let webgl2Available

function hasWebGL2() {
  if (webgl2Available !== undefined) return webgl2Available
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    webgl2Available = Boolean(context)
  } catch { webgl2Available = false }
  return webgl2Available
}

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() { return { failed: true } }

  render() { return this.state.failed ? <FallbackMap {...this.props.mapProps} /> : this.props.children }
}

export function ComplaintMap(props) {
  return <Suspense fallback={<div className="complaint-map complaint-map--loading" aria-label="Loading map" />}>{hasWebGL2() ? <MapErrorBoundary mapProps={props}><ModernMap {...props} /></MapErrorBoundary> : <FallbackMap {...props} />}</Suspense>
}
