import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react'

/**
 * Sfondo animato della login (anteprima lg-base, variante D): gradiente in WebGL
 * con ShaderGradient (MIT, github.com/ruucm/shadergradient). Caricato con React.lazy
 * solo sulla pagina di login, così three.js non pesa sul resto dell'app.
 */
const PALETTE = {
  light: { color1: '#6fae9b', color2: '#c3e0d6', color3: '#93acc4', brightness: 1.15 },
  dark: { color1: '#1f5a4c', color2: '#173f37', color3: '#2b4258', brightness: 0.85 },
}

export default function LoginBackground({ dark, still }: { dark: boolean; still: boolean }) {
  return (
    <ShaderGradientCanvas style={{ position: 'absolute', inset: 0 }} pixelDensity={1} fov={45} lazyLoad={false}>
      <ShaderGradient
        control="props" type="waterPlane" animate={still ? 'off' : 'on'}
        uTime={2} uSpeed={0.32} uStrength={3.2} uDensity={1.7} uFrequency={5.5} uAmplitude={0}
        positionX={0} positionY={0} positionZ={0} rotationX={0} rotationY={10} rotationZ={50}
        cAzimuthAngle={180} cPolarAngle={90} cDistance={3.6} cameraZoom={1}
        lightType="3d" reflection={0.1} grain="off"
        {...PALETTE[dark ? 'dark' : 'light']}
      />
    </ShaderGradientCanvas>
  )
}
